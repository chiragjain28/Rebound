import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

const router = Router();

// Get paginated and searchable debtor groups
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';

    // Step 1: Find unique customer names with unpaid udhars
    const whereClause: any = {
      status: 'unpaid'
    };

    if (search) {
      whereClause.customerName = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const groupedDebtors = await prisma.udhar.groupBy({
      by: ['customerName'],
      where: whereClause,
      _max: {
        createdAt: true
      }
    });

    // Step 2: Sort grouped debtors by their most recent unpaid debt date descending
    const sortedDebtors = groupedDebtors.sort((a, b) => {
      const dateA = a._max.createdAt ? new Date(a._max.createdAt).getTime() : 0;
      const dateB = b._max.createdAt ? new Date(b._max.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const total = sortedDebtors.length;
    const paginatedDebtorNames = sortedDebtors.slice(skip, skip + limit).map(d => d.customerName);

    // Step 3: Fetch all udhar entries (both paid and unpaid) for only the paginated customer names
    const udhars = paginatedDebtorNames.length > 0 ? await prisma.udhar.findMany({
      where: {
        customerName: { in: paginatedDebtorNames, mode: 'insensitive' }
      },
      include: { session: { include: { table: true } } },
      orderBy: { createdAt: 'desc' }
    }) : [];

    res.json({
      udhars,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create udhar entry
router.post('/', authenticateToken, async (req, res) => {
  const { customerName, amount, sessionId } = req.body;

  if (!customerName || amount === undefined || isNaN(amount)) {
    return res.status(400).json({ error: 'customerName and amount are required' });
  }

  try {
    const udhar = await prisma.udhar.create({
      data: {
        customerName,
        amount: parseFloat(amount),
        sessionId: sessionId || null,
        status: 'unpaid'
      },
      include: { session: { include: { table: true } } }
    });

    if (sessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { paymentStatus: 'udhar' }
      });
    }

    broadcast({ type: 'UDHAR_CREATE', udhar });
    res.status(201).json(udhar);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settlement / Pay udhar
router.post('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const udharId = parseInt(req.params.id);
    const udhar = await prisma.udhar.findUnique({
      where: { id: udharId }
    });

    if (!udhar) {
      return res.status(404).json({ error: 'Udhar entry not found' });
    }

    const updatedUdhar = await prisma.udhar.update({
      where: { id: udharId },
      data: { status: 'paid' },
      include: { session: { include: { table: true } } }
    });

    if (udhar.sessionId) {
      await prisma.session.update({
        where: { id: udhar.sessionId },
        data: { paymentStatus: 'paid' }
      });
    }

    broadcast({ type: 'UDHAR_PAY', udhar: updatedUdhar });
    res.json(updatedUdhar);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
