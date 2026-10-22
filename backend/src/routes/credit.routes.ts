import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

const router = Router();

// 1. Get paginated and searchable list of debtors / credit accounts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || '').trim();

    const whereCustomer: any = {
      currentCreditDue: { gt: 0 }
    };

    if (search) {
      whereCustomer.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }

    const [total, customersWithCredit] = await Promise.all([
      prisma.customer.count({ where: whereCustomer }),
      prisma.customer.findMany({
        where: whereCustomer,
        skip,
        take: limit,
        orderBy: { currentCreditDue: 'desc' },
        include: {
          creditRecords: {
            where: { status: 'unpaid' },
            orderBy: { createdAt: 'desc' },
            include: { visit: true }
          }
        }
      })
    ]);

    // Format for response
    const debtors = customersWithCredit.map(c => ({
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone,
      totalCreditDue: c.currentCreditDue,
      unpaidCount: c.creditRecords.length,
      creditRecords: c.creditRecords.map(cr => ({
        id: cr.id,
        amount: cr.amount,
        settledAmount: cr.settledAmount,
        due: cr.amount - cr.settledAmount,
        status: cr.status,
        notes: cr.notes,
        createdAt: cr.createdAt,
        visitId: cr.visitId
      }))
    }));

    // Backwards-compatible "udhars" array mapping for any legacy UI
    const legacyUdhars = customersWithCredit.flatMap(c =>
      c.creditRecords.map(cr => ({
        id: cr.id,
        customerName: c.name,
        customerPhone: c.phone,
        amount: cr.amount,
        sessionId: cr.visitId,
        status: cr.status,
        createdAt: cr.createdAt,
        session: cr.visit ? { ...cr.visit, customerName: c.name } : null
      }))
    );

    res.json({
      debtors,
      udhars: legacyUdhars,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a credit record
router.post('/', authenticateToken, async (req, res) => {
  const { customerId: rawCustId, customerName, amount, visitId: rawVisitId, sessionId, notes } = req.body;
  const visitId = rawVisitId || sessionId;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  try {
    let customerId = rawCustId ? parseInt(rawCustId) : null;

    if (!customerId && visitId) {
      const v = await prisma.visit.findUnique({ where: { id: visitId } });
      if (v) customerId = v.customerId;
    }

    if (!customerId && customerName) {
      const c = await prisma.customer.findFirst({
        where: { name: { equals: (customerName as string).trim(), mode: 'insensitive' } }
      });
      if (c) customerId = c.id;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Customer could not be resolved' });
    }

    const creditRecord = await prisma.creditRecord.create({
      data: {
        customerId,
        visitId: visitId || null,
        amount: numAmount,
        settledAmount: 0,
        status: 'unpaid',
        notes: notes || null
      },
      include: {
        customer: true,
        visit: true
      }
    });

    // Update customer currentCreditDue
    await prisma.customer.update({
      where: { id: customerId },
      data: { currentCreditDue: { increment: numAmount } }
    });

    broadcast({ type: 'CREDIT_RECORD_CREATE', creditRecord, udhar: creditRecord });
    res.status(201).json(creditRecord);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Settle / Pay a credit record
router.post('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const creditId = parseInt(req.params.id);
    const creditRecord = await prisma.creditRecord.findUnique({
      where: { id: creditId },
      include: { customer: true, visit: true }
    });

    if (!creditRecord) {
      return res.status(404).json({ error: 'Credit record not found' });
    }

    if (creditRecord.status === 'paid') {
      return res.status(400).json({ error: 'Credit record is already settled' });
    }

    const dueAmount = creditRecord.amount - creditRecord.settledAmount;

    // Update credit record to paid
    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.creditRecord.update({
        where: { id: creditId },
        data: {
          status: 'paid',
          settledAmount: creditRecord.amount
        },
        include: { customer: true, visit: true }
      });

      // Record a settlement Payment
      await tx.payment.create({
        data: {
          customerId: rec.customerId,
          visitId: rec.visitId,
          amount: dueAmount,
          method: 'Cash',
          type: 'credit_settlement'
        }
      });

      // Update customer stats
      await tx.customer.update({
        where: { id: rec.customerId },
        data: {
          currentCreditDue: { decrement: dueAmount },
          lifetimePaid: { increment: dueAmount }
        }
      });

      // If associated with a visit, update visit balance
      if (rec.visitId) {
        await tx.visit.update({
          where: { id: rec.visitId },
          data: {
            balanceDue: 0,
            paymentStatus: 'paid'
          }
        });
      }

      return rec;
    });

    broadcast({ type: 'CREDIT_RECORD_PAY', creditRecord: updated, udhar: updated });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
