import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { getPlayHourlyRate } from '../utils/pricing';

const router = Router();

// Helper: search customers handler
async function handleCustomerSearch(req: any, res: any) {
  try {
    const search = (((req.query.search || req.query.q) as string) || '').trim();

    let whereClause: any = {};
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      whereClause = {
        AND: tokens.map((tok) => ({
          OR: [
            { firstName: { contains: tok, mode: 'insensitive' } },
            { lastName: { contains: tok, mode: 'insensitive' } },
            { name: { contains: tok, mode: 'insensitive' } },
            { 
              AND: [
                { phone: { contains: tok } },
                { NOT: { phone: { startsWith: 'WALK-' } } },
                { NOT: { phone: { startsWith: 'QUICK-' } } }
              ]
            }
          ]
        }))
      };
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      take: 50
    });

    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// 1. GET /api/customers - Search customers by name, surname, or phone
router.get('/', authenticateToken, handleCustomerSearch);
router.get('/search', authenticateToken, handleCustomerSearch);

// 1b. GET /api/customers/all - Full customer directory list for autocompletes & modals
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        currentCreditDue: true,
        totalVisits: true
      }
    });

    const formatted = customers.map(c => ({
      id: c.id,
      name: c.name,
      customerName: c.name,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      customerPhone: c.phone,
      currentCreditDue: c.currentCreditDue,
      totalVisits: c.totalVisits
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to get local date string YYYY-MM-DD
const getLocalDateStr = (d: Date | string | number = new Date()): string => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 2. GET /api/customers/:phone/history - Comprehensive day-wise itemized visit & credit audit history
router.get('/:phone/history', authenticateToken, async (req, res) => {
  try {
    const rawParam = decodeURIComponent(req.params.phone.trim());
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: rawParam },
          { name: { equals: rawParam, mode: 'insensitive' } },
          ...(!isNaN(Number(rawParam)) && Number(rawParam) > 0 && Number(rawParam) <= 2147483647 && rawParam.length <= 8 ? [{ id: Number(rawParam) }] : [])
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customer.id;

    // Fetch all visits (active & completed) for this customer
    const visits = await prisma.visit.findMany({
      where: { customerId },
      include: {
        orders: {
          include: {
            menuItem: {
              select: { id: true, name: true, category: true, price: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        tablePlays: {
          include: {
            table: {
              select: { id: true, number: true, gameType: true }
            }
          },
          orderBy: { startTime: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        },
        creditRecords: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    // Fetch all historical legacy sessions for this customer
    const legacySessions = await prisma.legacySession.findMany({
      where: { customerId },
      orderBy: { startTime: 'desc' }
    });

    const legacySpend = legacySessions.reduce((sum, ls) => sum + (ls.totalBill || 0), 0);
    const legacyPaid = legacySessions.reduce((sum, ls) => sum + (ls.paidAmount || 0), 0);
    const earliestLegacy = legacySessions.length > 0 ? legacySessions[legacySessions.length - 1] : null;
    const memberSince = (earliestLegacy && new Date(earliestLegacy.startTime) < new Date(customer.createdAt))
      ? earliestLegacy.startTime
      : customer.createdAt;

    // Fetch all unpaid credit records for customer
    const unpaidCredits = await prisma.creditRecord.findMany({
      where: {
        customerId,
        status: 'unpaid'
      },
      include: {
        visit: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const currentCreditDue = unpaidCredits.reduce((sum, c) => sum + (c.amount - c.settledAmount), 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const previousUnpaidCredits = unpaidCredits.filter(c => new Date(c.createdAt) < startOfToday);
    const previousCreditDue = previousUnpaidCredits.reduce((sum, c) => sum + (c.amount - c.settledAmount), 0);

    const todayStr = getLocalDateStr(new Date());

    // Group visits by local date of startTime (e.g. 23:30 on 19th Oct stays on 19th Oct)
    const daysMap = new Map<string, {
      date: string;
      formattedDate: string;
      isToday: boolean;
      totalDayBill: number;
      totalDayPaid: number;
      dayCreditAdded: number;
      dayUdharAdded: number;
      visits: any[];
    }>();

    let totalLifetimeBill = 0;
    let totalLifetimePaid = 0;

    for (const v of visits) {
      // Calculate live table play cost for any in-progress plays
      const calculatedTablePlays = v.tablePlays.map(tp => {
        let cost = tp.cost;
        if (!tp.endTime) {
          const elapsedHours = Math.max(0, (Date.now() - new Date(tp.startTime).getTime()) / (1000 * 60 * 60));
          const rate = getPlayHourlyRate(tp);
          cost = Math.round(elapsedHours * rate * 100) / 100;
        }
        return {
          id: tp.id,
          gameType: tp.gameType,
          tableName: tp.table ? `${tp.table.gameType} Table ${tp.table.number}` : (tp.gameType === 'PS4' ? 'PS4 Station' : tp.gameType),
          playerCount: tp.playerCount,
          startTime: tp.startTime,
          endTime: tp.endTime,
          cost,
          createdBy: tp.createdBy
        };
      });

      let visitTablesCost = v.tablesTotal;
      let visitTotal = v.visitTotal;
      if (v.status === 'active') {
        visitTablesCost = calculatedTablePlays.reduce((sum, p) => sum + p.cost, 0);
        visitTotal = Math.round((v.itemsTotal + visitTablesCost + v.customAmount) * 100) / 100;
      }

      totalLifetimeBill += visitTotal;
      const vPaid = v.payments.reduce((sum, p) => sum + p.amount, 0);
      totalLifetimePaid += vPaid;

      const dateKey = getLocalDateStr(v.startTime);
      const dateObj = new Date(v.startTime);
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          date: dateKey,
          formattedDate,
          isToday: dateKey === todayStr,
          totalDayBill: 0,
          totalDayPaid: 0,
          dayCreditAdded: 0,
          dayUdharAdded: 0,
          visits: []
        });
      }

      const vSettledCredit = v.creditRecords.reduce((sum, c) => sum + (c.settledAmount || 0), 0);
      const vUnpaidCredit = v.creditRecords.filter(c => c.status === 'unpaid').reduce((sum, c) => sum + (c.amount - c.settledAmount), 0);
      const vTotalPaid = vPaid + vSettledCredit;
      const vBalanceDue = v.creditRecords.length > 0 ? vUnpaidCredit : Math.max(0, visitTotal - vPaid);
      let vPaymentStatus = v.paymentStatus;
      if (vBalanceDue === 0 && (vTotalPaid > 0 || visitTotal === 0)) {
        vPaymentStatus = 'paid';
      } else if (vBalanceDue > 0 && vTotalPaid > 0) {
        vPaymentStatus = 'partially_paid';
      }

      const dayGroup = daysMap.get(dateKey)!;
      dayGroup.totalDayBill += visitTotal;
      dayGroup.totalDayPaid += vTotalPaid;
      dayGroup.dayCreditAdded += vUnpaidCredit;
      dayGroup.dayUdharAdded += vUnpaidCredit;

      dayGroup.visits.push({
        id: v.id,
        status: v.status,
        startTime: v.startTime,
        endTime: v.endTime,
        totalBill: visitTotal,
        visitTotal,
        gameCost: visitTablesCost,
        tablesTotal: visitTablesCost,
        menuCost: v.itemsTotal,
        itemsTotal: v.itemsTotal,
        customAmount: v.customAmount,
        paidAmount: vTotalPaid,
        balanceDue: vBalanceDue,
        paymentStatus: vPaymentStatus,
        tablePlays: calculatedTablePlays,
        orders: v.orders.map(o => ({
          id: o.id,
          name: o.menuItem?.name || 'Item',
          category: o.menuItem?.category || 'General',
          price: o.price,
          quantity: o.quantity,
          total: o.price * o.quantity,
          createdAt: o.createdAt
        })),
        payments: v.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          type: p.type,
          createdAt: p.createdAt
        })),
        creditRecords: v.creditRecords.map(c => ({
          id: c.id,
          amount: c.amount,
          settledAmount: c.settledAmount,
          due: c.amount - c.settledAmount,
          status: c.status,
          notes: c.notes,
          createdAt: c.createdAt
        })),
        udhars: v.creditRecords.map(c => ({
          id: c.id,
          amount: c.amount,
          status: c.status,
          createdAt: c.createdAt
        }))
      });
    }

    // Sort visits within each day chronologically
    for (const day of daysMap.values()) {
      day.visits.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    // Build structured breakdown of unpaid credits
    const unpaidCreditBreakdown = unpaidCredits.map(c => {
      const v = c.visit;
      const dateKey = v ? getLocalDateStr(v.startTime) : getLocalDateStr(c.createdAt);
      const day = daysMap.get(dateKey);
      const visitIdx = v && day ? day.visits.findIndex(visit => visit.id === v.id) : -1;
      const visitNumber = visitIdx >= 0 ? visitIdx + 1 : null;

      const dateObj = new Date(v ? v.startTime : c.createdAt);
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        id: c.id,
        amount: c.amount,
        settledAmount: c.settledAmount,
        due: c.amount - c.settledAmount,
        date: dateKey,
        formattedDate,
        timeStr,
        visitId: v?.id || c.visitId || null,
        sessionId: v?.id || c.visitId || null,
        visitNumber,
        isManual: !v,
        notes: c.notes || (c.visitId ? `Visit #${visitNumber}` : 'Credit Balance'),
        visitTotal: v?.visitTotal || null,
        visitStatus: v?.status || null
      };
    });

    const timeline = Array.from(daysMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    const totalLifetimeSpend = Math.round((totalLifetimeBill + legacySpend) * 100) / 100;
    const totalLifetimePayment = Math.round((totalLifetimePaid + legacyPaid) * 100) / 100;

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        memberSince,
        totalVisits: visits.length,
        totalLegacySessions: legacySessions.length,
        lifetimeSpend: totalLifetimeSpend,
        lifetimePaid: totalLifetimePayment,
        currentCreditDue,
        currentUdharDue: currentCreditDue,
        previousCreditDue,
        previousUdharDue: previousCreditDue,
        unpaidCreditsBreakdown: unpaidCreditBreakdown,
        unpaidUdharsBreakdown: unpaidCreditBreakdown
      },
      timeline,
      legacySessions: legacySessions.map(ls => ({
        id: ls.id,
        startTime: ls.startTime,
        endTime: ls.endTime,
        status: ls.status,
        staffUsername: ls.staffUsername,
        tablesTotal: ls.tablesTotal,
        itemsTotal: ls.itemsTotal,
        customAmount: ls.customAmount,
        totalBill: ls.totalBill,
        paidAmount: ls.paidAmount,
        balanceDue: ls.balanceDue,
        paymentStatus: ls.paymentStatus,
        orders: ls.orders || [],
        tablePlays: ls.tablePlays || [],
        payments: ls.payments || []
      }))
    });
  } catch (error: any) {
    console.error('Error in customer history:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/customers/:phone/payments - Get last payments for customer
router.get('/:phone/payments', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone },
          { name: { equals: phone, mode: 'insensitive' } }
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const payments = await prisma.payment.findMany({
      where: { customerId: customer.id },
      include: {
        visit: {
          select: {
            id: true,
            status: true,
            visitTotal: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3b. GET /api/customers/:phone/eligibility - Deletion eligibility check (guarantees CustomerManagerModal can verify status safely)
router.get('/:phone/eligibility', authenticateToken, async (req, res) => {
  try {
    const rawParam = decodeURIComponent(req.params.phone.trim());
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: rawParam },
          { name: { equals: rawParam, mode: 'insensitive' } },
          ...(!isNaN(Number(rawParam)) && Number(rawParam) > 0 && Number(rawParam) <= 2147483647 && rawParam.length <= 8 ? [{ id: Number(rawParam) }] : [])
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [activeVisit, unpaidCredit] = await Promise.all([
      prisma.visit.findFirst({
        where: { customerId: customer.id, status: 'active' },
        include: {
          tablePlays: {
            where: { endTime: null },
            include: { table: true }
          }
        }
      }),
      prisma.creditRecord.findFirst({
        where: { customerId: customer.id, status: 'unpaid' }
      })
    ]);

    const hasActiveSession = !!activeVisit;
    const hasUnpaidCredit = !!unpaidCredit || (customer.currentCreditDue > 0);
    const canDelete = !hasActiveSession && !hasUnpaidCredit;

    let activeSessionInfo = null;
    if (activeVisit) {
      const runningPlay = activeVisit.tablePlays?.[0];
      const tableName = runningPlay?.table?.name || (runningPlay?.table ? `${runningPlay.table.gameType} Table ${runningPlay.table.number}` : runningPlay?.gameType || 'Active Table');
      activeSessionInfo = {
        id: activeVisit.id,
        tableName
      };
    }

    res.json({
      canDelete,
      hasActiveSession,
      activeSession: activeSessionInfo,
      hasUnpaidCredit,
      currentCreditDue: customer.currentCreditDue
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. POST /api/customers - Add a new customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Standardize to strictly 10 digits
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile phone number' });
    }

    const cleanFirst = firstName.trim();
    const cleanLast = (lastName || '').trim();
    const fullName = (cleanFirst + ' ' + cleanLast).trim();

    // Strict Uniqueness Check: Check exact or 10-digit phone (ignore WALK- and QUICK- placeholders)
    const existing = await prisma.customer.findFirst({
      where: {
        AND: [
          { NOT: { phone: { startsWith: 'WALK-' } } },
          { NOT: { phone: { startsWith: 'QUICK-' } } },
          {
            OR: [
              { phone: cleanPhone },
              { phone: { endsWith: cleanPhone } }
            ]
          }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({ 
        error: `Customer already exists with phone number ${cleanPhone} (${existing.name}). Duplicate phone numbers are strictly prohibited.`,
        existingCustomer: existing
      });
    }

    const customer = await prisma.customer.create({
      data: {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: fullName,
        phone: cleanPhone
      }
    });

    res.status(201).json(customer);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'A customer with this phone number already exists in the database. Duplicate phone numbers are strictly prohibited.'
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// 5. PUT /api/customers/:phone - Edit First Name and Surname (Phone is strictly immutable)
router.put('/:phone', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const { firstName, lastName } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }

    const existing = await prisma.customer.findUnique({
      where: { phone }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const cleanFirst = firstName.trim();
    const cleanLast = (lastName || '').trim();
    const newFullName = (cleanFirst + ' ' + cleanLast).trim();

    const updatedCustomer = await prisma.customer.update({
      where: { phone },
      data: {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: newFullName
      }
    });

    res.json(updatedCustomer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5b. POST /api/customers/:idOrPhone/register-walkin - Upgrade a temporary walk-in to a permanent registered customer
router.post('/:idOrPhone/register-walkin', authenticateToken, async (req, res) => {
  try {
    const idOrPhone = decodeURIComponent(req.params.idOrPhone.trim());
    const { phone, firstName, lastName } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'A valid 10-digit mobile phone number is required to register.' });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile phone number.' });
    }

    // Find the customer by ID or phone
    const isId = !isNaN(Number(idOrPhone)) && Number(idOrPhone) > 0 && Number(idOrPhone) <= 2147483647;
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          ...(isId ? [{ id: Number(idOrPhone) }] : []),
          { phone: idOrPhone }
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Verify customer is currently an unregistered walk-in (starts with WALK- or non-standard phone)
    if (!customer.phone.startsWith('WALK-') && customer.phone.length === 10) {
      return res.status(400).json({ 
        error: `This customer is already registered with a verified mobile number (${customer.phone}). Registered phone numbers are strictly immutable.` 
      });
    }

    // Check if new phone is already registered to someone else
    const existingWithPhone = await prisma.customer.findFirst({
      where: {
        AND: [
          { NOT: { id: customer.id } },
          { NOT: { phone: { startsWith: 'WALK-' } } },
          { NOT: { phone: { startsWith: 'QUICK-' } } },
          {
            OR: [
              { phone: cleanPhone },
              { phone: { endsWith: cleanPhone } }
            ]
          }
        ]
      }
    });

    if (existingWithPhone) {
      return res.status(409).json({
        error: `Cannot register: Phone number ${cleanPhone} is already registered to ${existingWithPhone.name} (#CUST-${existingWithPhone.id}). Duplicate phone numbers are strictly prohibited.`,
        existingCustomer: existingWithPhone
      });
    }

    const cleanFirst = (firstName !== undefined && firstName.trim()) ? firstName.trim() : (customer.firstName || customer.name);
    const cleanLast = (lastName !== undefined) ? lastName.trim() : (customer.lastName || '');
    const newFullName = (cleanFirst + (cleanLast ? ' ' + cleanLast : '')).trim();

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        phone: cleanPhone,
        firstName: cleanFirst,
        lastName: cleanLast,
        name: newFullName
      }
    });

    res.json({
      success: true,
      message: `Customer successfully registered as a permanent member with phone ${cleanPhone}!`,
      customer: updatedCustomer
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'A customer with this phone number already exists in the database. Duplicate phone numbers are strictly prohibited.'
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// 6. DELETE /api/customers/:phone - Delete customer profile from DB
router.delete('/:phone', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();

    const existing = await prisma.customer.findUnique({
      where: { phone }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check active visit
    const activeVisit = await prisma.visit.findFirst({
      where: { customerId: existing.id, status: 'active' }
    });

    const unpaidCredit = await prisma.creditRecord.findFirst({
      where: { customerId: existing.id, status: 'unpaid' }
    });

    if (activeVisit) {
      return res.status(400).json({
        error: `Cannot delete customer: An active visit is currently in progress. Please complete the visit first.`
      });
    }

    if (unpaidCredit) {
      return res.status(400).json({
        error: `Cannot delete customer: Customer has an outstanding credit balance of ₹${existing.currentCreditDue}. Settle all credit records before deleting.`
      });
    }

    await prisma.customer.delete({
      where: { id: existing.id }
    });

    res.json({ message: `Customer "${existing.name}" deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
