import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';
import { runNightlyAutoClose } from '../services/autoClose.service';
import { getPlayHourlyRate } from '../utils/pricing';

const router = Router();

// Game hourly rates (₹ per hour)
const GAME_RATES: Record<string, number> = {
  'Pool': 160,
  'MidSnooker': 220,
  'PS4': 80, // ₹80 per person per hour
  'None': 0,
};

// 1. Create / Start a new visit
router.post('/', authenticateToken, async (req: any, res) => {
  const { staffUsername, customerId, customerName, customerPhone, advanceAmount, advanceMethod } = req.body;
  const staff = staffUsername || req.user?.username || 'chirag';

  if (!customerId && !customerName && !customerPhone) {
    return res.status(400).json({ error: 'Customer information (ID, name, or phone) is required' });
  }

  try {
    let customer: any = null;

    // Resolve or create customer
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
    }

    if (!customer && customerPhone) {
      const cleanPhone = (customerPhone as string).trim();
      customer = await prisma.customer.findUnique({ where: { phone: cleanPhone } });
    }

    if (!customer && customerName) {
      const cleanName = (customerName as string).trim();
      customer = await prisma.customer.findFirst({
        where: { name: { equals: cleanName, mode: 'insensitive' } }
      });
    }

    if (!customer) {
      const cleanName = (customerName || 'Walk-in Guest').trim();
      const parts = cleanName.split(/\s+/);
      const firstName = parts[0] || cleanName;
      const lastName = parts.slice(1).join(' ') || '';
      const cleanPhone = customerPhone && customerPhone.trim().length >= 10
        ? customerPhone.trim()
        : `WALK-${Date.now().toString().slice(-6)}`;

      customer = await prisma.customer.create({
        data: {
          firstName,
          lastName,
          name: cleanName,
          phone: cleanPhone,
        }
      });
    }

    // Check if customer already has an active visit
    const existingActiveVisit = await prisma.visit.findFirst({
      where: {
        customerId: customer.id,
        status: 'active'
      },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      }
    });

    if (existingActiveVisit) {
      return res.status(200).json(existingActiveVisit);
    }

    // Generate Visit ID: V_DDMMYYYYHHMMSS_customername
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const cleanCustomerSlug = customer.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const visitId = `${timestamp}_${cleanCustomerSlug}`;

    const numAdvance = parseFloat(advanceAmount);
    const hasAdvance = !isNaN(numAdvance) && numAdvance > 0;

    const visit = await prisma.visit.create({
      data: {
        id: visitId,
        customerId: customer.id,
        staffUsername: staff.toLowerCase(),
        startTime: now,
        status: 'active',
        paidAmount: hasAdvance ? numAdvance : 0,
        payments: hasAdvance ? {
          create: {
            customerId: customer.id,
            amount: numAdvance,
            method: advanceMethod || 'Cash',
            type: 'visit_payment'
          }
        } : undefined
      },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      }
    });

    // Update customer total visits count
    await prisma.customer.update({
      where: { id: customer.id },
      data: { totalVisits: { increment: 1 } }
    });

    broadcast({ type: 'VISIT_START', visit, session: visit });
    res.status(201).json(visit);
  } catch (error: any) {
    console.error('Error starting visit:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get active visits
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      where: { status: 'active' },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      },
      orderBy: { startTime: 'desc' }
    });
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get completed visits (paginated)
router.get('/completed', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const search = ((req.query.search as string) || '').trim();
    const date = (req.query.date as string) || '';
    const skip = (page - 1) * limit;

    const where: any = { status: 'completed' };

    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search } } },
        { id: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.startTime = { gte: start, lte: end };
    }

    const [total, visits] = await Promise.all([
      prisma.visit.count({ where }),
      prisma.visit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { endTime: 'desc' },
        include: {
          customer: true,
          orders: { include: { menuItem: true } },
          tablePlays: { include: { table: true } },
          payments: true,
          creditRecords: true
        }
      })
    ]);

    // Provide both visits and sessions key for backward-compatibility with UI
    res.json({
      visits,
      sessions: visits,
      total,
      totalSessions: total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3b. GET /api/visits/customers/all (and /api/sessions/customers/all via bridge)
router.get('/customers/all', authenticateToken, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        currentCreditDue: true,
        totalVisits: true
      }
    });

    const formatted = customers.map(c => ({
      id: c.id,
      name: c.name,
      customerName: c.name,
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

// 4. Get single visit by ID (mapped with backwards-compatible session properties)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: {
            creditRecords: {
              where: { status: 'unpaid' },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        orders: {
          include: { menuItem: true },
          orderBy: { createdAt: 'asc' }
        },
        tablePlays: {
          include: { table: true },
          orderBy: { startTime: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        },
        creditRecords: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const legacySessionCompat = {
      ...visit,
      customerName: visit.customer?.name || '',
      customerPhone: visit.customer?.phone || '',
      totalCost: visit.visitTotal,
      totalBill: visit.visitTotal,
      gameCost: visit.tablesTotal,
      menuCost: visit.itemsTotal
    };

    res.json(legacySessionCompat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Start a TablePlay inside a visit
router.post('/:id/table/start', authenticateToken, async (req: any, res) => {
  const visitId = req.params.id;
  const { tableId, gameType, playerCount } = req.body;
  const staffUsername = req.user?.username || 'chirag';

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit || visit.status !== 'active') {
      return res.status(404).json({ error: 'Active visit not found' });
    }

    // Check table availability if tableId is provided
    let table = null;
    if (tableId) {
      table = await prisma.table.findUnique({ where: { id: parseInt(tableId) } });
      if (!table) return res.status(404).json({ error: 'Table not found' });
      const activePlay = await prisma.tablePlay.findFirst({
        where: { tableId: parseInt(tableId), endTime: null }
      });
      if (activePlay) {
        return res.status(400).json({ error: `Table ${table.number} is already occupied` });
      }
    }

    const playType = gameType || table?.gameType || 'Pool';
    const parsedPlayerCount = playType === 'PS4'
      ? Math.max(1, Math.min(4, parseInt(playerCount) || 1))
      : 1;
    const now = new Date();

    const [tablePlay, updatedTable] = await prisma.$transaction([
      prisma.tablePlay.create({
        data: {
          visitId,
          tableId: table ? table.id : null,
          gameType: playType,
          playerCount: parsedPlayerCount,
          startTime: now,
          createdBy: staffUsername
        },
        include: { table: true }
      }),
      ...(table ? [
        prisma.table.update({
          where: { id: table.id },
          data: { status: 'occupied' }
        })
      ] : [])
    ]);

    broadcast({ type: 'TABLE_PLAY_START', play: tablePlay, visitId });
    if (updatedTable) broadcast({ type: 'TABLE_UPDATE', table: updatedTable });

    res.status(201).json(tablePlay);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Stop/End a TablePlay inside a visit
router.post('/:id/table/end', authenticateToken, async (req, res) => {
  const visitId = req.params.id;
  const { tablePlayId, cost: overrideCost } = req.body;

  try {
    const play = await prisma.tablePlay.findFirst({
      where: {
        id: parseInt(tablePlayId),
        visitId
      },
      include: { table: true }
    });

    if (!play) {
      return res.status(404).json({ error: 'Table play record not found' });
    }

    const endTime = req.body.endTime ? new Date(req.body.endTime) : new Date();
    const durationMinutes = Math.max(1, (endTime.getTime() - new Date(play.startTime).getTime()) / 60000);
    const hourlyRate = getPlayHourlyRate(play);

    let finalCost = overrideCost !== undefined ? parseFloat(overrideCost) : 0;
    if (overrideCost === undefined) {
      finalCost = Math.round((durationMinutes / 60) * hourlyRate);
    }

    const [updatedPlay, updatedTable] = await prisma.$transaction([
      prisma.tablePlay.update({
        where: { id: play.id },
        data: {
          endTime,
          cost: finalCost
        },
        include: { table: true }
      }),
      ...(play.tableId ? [
        prisma.table.update({
          where: { id: play.tableId },
          data: { status: 'available' }
        })
      ] : [])
    ]);

    // Recalculate visit totals
    const allPlays = await prisma.tablePlay.findMany({ where: { visitId } });
    const tablesTotal = allPlays.reduce((sum, p) => sum + p.cost, 0);

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { orders: true, payments: true }
    });

    if (visit) {
      const itemsTotal = visit.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
      const visitTotal = itemsTotal + tablesTotal + visit.customAmount;
      const paidAmount = visit.payments.reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = Math.max(0, visitTotal - paidAmount);

      await prisma.visit.update({
        where: { id: visitId },
        data: {
          tablesTotal,
          itemsTotal,
          visitTotal,
          balanceDue
        }
      });
    }

    broadcast({ type: 'TABLE_PLAY_END', play: updatedPlay, visitId });
    if (updatedTable) broadcast({ type: 'TABLE_UPDATE', table: updatedTable });

    res.json(updatedPlay);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Delete an erroneous TablePlay
router.delete('/:id/table-play/:playId', authenticateToken, async (req, res) => {
  const visitId = req.params.id;
  const playId = parseInt(req.params.playId);

  try {
    const play = await prisma.tablePlay.findFirst({
      where: { id: playId, visitId },
      include: { table: true }
    });

    if (!play) {
      return res.status(404).json({ error: 'Table play record not found' });
    }

    await prisma.$transaction([
      prisma.tablePlay.delete({ where: { id: playId } }),
      ...(play.tableId && !play.endTime ? [
        prisma.table.update({
          where: { id: play.tableId },
          data: { status: 'available' }
        })
      ] : [])
    ]);

    // Recalculate totals
    const allPlays = await prisma.tablePlay.findMany({ where: { visitId } });
    const tablesTotal = allPlays.reduce((sum, p) => sum + p.cost, 0);

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { orders: true, payments: true }
    });

    if (visit) {
      const itemsTotal = visit.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
      const visitTotal = itemsTotal + tablesTotal + visit.customAmount;
      const paidAmount = visit.payments.reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = Math.max(0, visitTotal - paidAmount);

      await prisma.visit.update({
        where: { id: visitId },
        data: { tablesTotal, itemsTotal, visitTotal, balanceDue }
      });
    }

    broadcast({ type: 'TABLE_PLAY_DELETE', playId, visitId });
    res.json({ message: 'Table play record removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Recalculates all financial totals (tablesTotal, itemsTotal, visitTotal, balanceDue)
 * for a specific visit inside an existing Prisma transaction or client.
 */
async function recalculateVisitTotals(tx: any, visitId: string) {
  const [allPlays, visit] = await Promise.all([
    tx.tablePlay.findMany({ where: { visitId } }),
    tx.visit.findUnique({
      where: { id: visitId },
      include: { orders: true, payments: true }
    })
  ]);

  if (!visit) return null;

  const tablesTotal = allPlays.reduce((sum: number, p: any) => sum + (p.cost || 0), 0);
  const itemsTotal = visit.orders.reduce((sum: number, o: any) => sum + (o.quantity * o.price), 0);
  const visitTotal = Math.round((itemsTotal + tablesTotal + (visit.customAmount || 0)) * 100) / 100;
  const paidAmount = visit.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
  const balanceDue = Math.max(0, Math.round((visitTotal - paidAmount) * 100) / 100);

  const updated = await tx.visit.update({
    where: { id: visitId },
    data: { tablesTotal, itemsTotal, visitTotal, balanceDue }
  });

  return updated;
}

/**
 * Helper: Finds an active visit for a customer or creates a new active visit if none exists.
 */
async function getOrCreateActiveVisit(tx: any, customerId: number, staffUsername: string) {
  let visit = await tx.visit.findFirst({
    where: {
      customerId,
      status: 'active'
    }
  });

  if (!visit) {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error(`Customer with ID ${customerId} not found`);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const cleanName = customer.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const visitId = `V_${timestamp}_${cleanName}`;

    visit = await tx.visit.create({
      data: {
        id: visitId,
        customerId: customer.id,
        staffUsername,
        startTime: now,
        status: 'active'
      }
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: { totalVisits: { increment: 1 } }
    });
  }

  return visit;
}

// 7b. Transfer TablePlay to another customer (e.g. loser pays rule)
router.post('/table-play/:playId/transfer', authenticateToken, async (req: any, res) => {
  const playId = parseInt(req.params.playId);
  const { targetCustomerId } = req.body;
  const staffUsername = req.user?.username || 'chirag';

  if (!targetCustomerId || isNaN(parseInt(targetCustomerId))) {
    return res.status(400).json({ error: 'Valid target customer ID is required' });
  }

  try {
    const play = await prisma.tablePlay.findUnique({
      where: { id: playId },
      include: {
        visit: { include: { customer: true } },
        table: true
      }
    });

    if (!play) {
      return res.status(404).json({ error: 'Table play record not found' });
    }

    if (play.visit.customerId === parseInt(targetCustomerId)) {
      return res.status(400).json({ error: 'Target customer cannot be the same as current player' });
    }

    const targetCustomer = await prisma.customer.findUnique({
      where: { id: parseInt(targetCustomerId) }
    });
    if (!targetCustomer) {
      return res.status(404).json({ error: 'Target customer not found in database' });
    }

    const sourceVisitId = play.visitId;
    let targetVisitId = '';

    await prisma.$transaction(async (tx) => {
      // 1. Get or create active visit for target customer
      const targetVisit = await getOrCreateActiveVisit(tx, targetCustomer.id, staffUsername);
      targetVisitId = targetVisit.id;

      // 2. Re-parent TablePlay to target visit
      await tx.tablePlay.update({
        where: { id: play.id },
        data: { visitId: targetVisit.id }
      });

      // 3. Recalculate financial totals for both source and target visits
      await recalculateVisitTotals(tx, sourceVisitId);
      await recalculateVisitTotals(tx, targetVisitId);
    });

    // Broadcast WebSocket updates for real-time reactivity
    broadcast({ type: 'TABLE_PLAY_UPDATE', playId, sourceVisitId, targetVisitId });
    broadcast({ type: 'VISIT_UPDATE', visitId: sourceVisitId });
    broadcast({ type: 'VISIT_UPDATE', visitId: targetVisitId });

    res.json({
      success: true,
      message: `Table play transferred successfully to ${targetCustomer.name}`,
      sourceVisitId,
      targetVisitId,
      targetCustomerName: targetCustomer.name
    });
  } catch (error: any) {
    console.error('Error transferring table play:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7c. Split TablePlay among multiple players (2, 3, 4+ players)
router.post('/table-play/:playId/split', authenticateToken, async (req: any, res) => {
  const playId = parseInt(req.params.playId);
  const { splits } = req.body;
  const staffUsername = req.user?.username || 'chirag';

  if (!Array.isArray(splits) || splits.length < 2) {
    return res.status(400).json({ error: 'At least 2 players are required to split a table play' });
  }

  try {
    const play = await prisma.tablePlay.findUnique({
      where: { id: playId },
      include: {
        visit: { include: { customer: true } },
        table: true
      }
    });

    if (!play) {
      return res.status(404).json({ error: 'Table play record not found' });
    }

    // If play is still running, stop it and lock its cost first
    let totalCost = play.cost;
    const now = new Date();
    if (!play.endTime) {
      const durationMinutes = Math.max(1, (now.getTime() - new Date(play.startTime).getTime()) / 60000);
      const hourlyRate = getPlayHourlyRate(play);
      totalCost = Math.round((durationMinutes / 60) * hourlyRate);

      await prisma.$transaction([
        prisma.tablePlay.update({
          where: { id: play.id },
          data: { endTime: now, cost: totalCost }
        }),
        ...(play.tableId ? [
          prisma.table.update({
            where: { id: play.tableId },
            data: { status: 'available' }
          })
        ] : [])
      ]);
      if (play.tableId) {
        broadcast({ type: 'TABLE_UPDATE', table: { id: play.tableId, status: 'available' } });
      }
    }

    if (totalCost <= 0) {
      return res.status(400).json({ error: 'Table play cost is ₹0. Cannot split zero amount.' });
    }

    // Validate splits format and sum
    let splitSum = 0;
    const customerIdsSeen = new Set<number>();

    for (const s of splits) {
      const cId = parseInt(s.customerId);
      const amt = parseFloat(s.amount);
      if (isNaN(cId) || isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: 'Every player must have a valid customer ID and an amount greater than 0' });
      }
      if (customerIdsSeen.has(cId)) {
        return res.status(400).json({ error: 'Duplicate customer found in split list. Each player must be unique.' });
      }
      customerIdsSeen.add(cId);
      splitSum += amt;
    }

    // Floating-point comparison tolerance (0.05)
    if (Math.abs(splitSum - totalCost) > 0.05) {
      return res.status(400).json({
        error: `Sum of split amounts (₹${splitSum.toFixed(2)}) must equal total table cost (₹${totalCost.toFixed(2)})`
      });
    }

    // Verify all customers exist
    const customers = await prisma.customer.findMany({
      where: { id: { in: Array.from(customerIdsSeen) } }
    });
    if (customers.length !== customerIdsSeen.size) {
      return res.status(404).json({ error: 'One or more selected co-players could not be found in database' });
    }

    const sourceCustomerId = play.visit.customerId;
    const sourceVisitId = play.visitId;
    const affectedVisitIds = new Set<string>([sourceVisitId]);

    await prisma.$transaction(async (tx) => {
      // Find the split for the source player
      const sourceSplit = splits.find(s => parseInt(s.customerId) === sourceCustomerId);
      const otherSplits = splits.filter(s => parseInt(s.customerId) !== sourceCustomerId);

      if (sourceSplit) {
        // Update original play row with source customer's portion
        await tx.tablePlay.update({
          where: { id: play.id },
          data: { cost: Math.round(parseFloat(sourceSplit.amount) * 100) / 100 }
        });
      } else {
        // Source customer pays 0, so first other split re-parents original row
        const firstCoSplit = otherSplits[0];
        const firstCoVisit = await getOrCreateActiveVisit(tx, parseInt(firstCoSplit.customerId), staffUsername);
        affectedVisitIds.add(firstCoVisit.id);

        await tx.tablePlay.update({
          where: { id: play.id },
          data: {
            visitId: firstCoVisit.id,
            cost: Math.round(parseFloat(firstCoSplit.amount) * 100) / 100
          }
        });
        otherSplits.shift();
      }

      // For every other co-player, create a split TablePlay record in their active visit
      for (const coSplit of otherSplits) {
        const cId = parseInt(coSplit.customerId);
        const coVisit = await getOrCreateActiveVisit(tx, cId, staffUsername);
        affectedVisitIds.add(coVisit.id);

        await tx.tablePlay.create({
          data: {
            visitId: coVisit.id,
            tableId: play.tableId,
            gameType: play.gameType,
            playerCount: play.playerCount,
            startTime: play.startTime,
            endTime: play.endTime || now,
            cost: Math.round(parseFloat(coSplit.amount) * 100) / 100,
            createdBy: staffUsername
          }
        });
      }

      // Recalculate totals for all affected visits
      for (const vId of affectedVisitIds) {
        await recalculateVisitTotals(tx, vId);
      }
    });

    // Broadcast WebSocket updates for all affected visits
    for (const vId of affectedVisitIds) {
      broadcast({ type: 'VISIT_UPDATE', visitId: vId });
    }
    broadcast({ type: 'TABLE_PLAY_UPDATE', playId });

    res.json({
      success: true,
      message: `Table play bill of ₹${totalCost.toFixed(2)} split successfully across ${splits.length} players`,
      totalCost,
      splitsCount: splits.length
    });
  } catch (error: any) {
    console.error('Error splitting table play:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Close Visit (allows full payment, partial payment, or converting unpaid balance to credit)
router.post('/:id/close', authenticateToken, async (req, res) => {
  const visitId = req.params.id;
  const { paymentAmount, paymentMethod, creditAmount, notes } = req.body;

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        customer: true,
        orders: true,
        tablePlays: { include: { table: true } },
        payments: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const now = new Date();

    // 1. End any active table plays
    for (const play of visit.tablePlays) {
      if (!play.endTime) {
        const durationMinutes = Math.max(1, (now.getTime() - new Date(play.startTime).getTime()) / 60000);
        const hourlyRate = getPlayHourlyRate(play);
        const playCost = Math.round((durationMinutes / 60) * hourlyRate);

        await prisma.tablePlay.update({
          where: { id: play.id },
          data: { endTime: now, cost: playCost }
        });

        if (play.tableId) {
          await prisma.table.update({
            where: { id: play.tableId },
            data: { status: 'available' }
          });
        }
      }
    }

    // 2. Compute final totals
    const allPlays = await prisma.tablePlay.findMany({ where: { visitId } });
    const tablesTotal = allPlays.reduce((sum, p) => sum + p.cost, 0);
    const itemsTotal = visit.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
    const visitTotal = itemsTotal + tablesTotal + visit.customAmount;

    // 3. Record new payment if provided (smart split between visit and past credit)
    let newPayment = null;
    let excessForCredit = 0;
    const numPay = parseFloat(paymentAmount);
    
    // Existing payments made prior to close
    const priorPaid = visit.payments.reduce((sum, p) => sum + p.amount, 0);
    const visitDueBeforePay = Math.max(0, visitTotal - priorPaid);

    if (!isNaN(numPay) && numPay > 0) {
      // Allocate payment to current visit first (up to visitDueBeforePay)
      const payForVisit = Math.min(numPay, visitDueBeforePay);
      excessForCredit = Math.max(0, Math.round((numPay - payForVisit) * 100) / 100);

      if (payForVisit > 0) {
        newPayment = await prisma.payment.create({
          data: {
            customerId: visit.customerId,
            visitId: visit.id,
            amount: payForVisit,
            method: paymentMethod || 'Cash',
            type: 'visit_payment'
          }
        });
      }

      // If customer paid more than visit total, apply excess to settle past unpaid credit records
      if (excessForCredit > 0) {
        let remainingToSettle = excessForCredit;
        const unpaidCredits = await prisma.creditRecord.findMany({
          where: {
            customerId: visit.customerId,
            status: 'unpaid',
            visitId: { not: visit.id }
          },
          orderBy: { createdAt: 'asc' }
        });

        for (const cr of unpaidCredits) {
          if (remainingToSettle <= 0) break;
          const due = cr.amount - cr.settledAmount;
          if (remainingToSettle >= due) {
            remainingToSettle -= due;
            await prisma.creditRecord.update({
              where: { id: cr.id },
              data: { status: 'paid', settledAmount: cr.amount }
            });
          } else {
            await prisma.creditRecord.update({
              where: { id: cr.id },
              data: { settledAmount: cr.settledAmount + remainingToSettle }
            });
            remainingToSettle = 0;
          }
        }

        const actuallySettledCredit = excessForCredit - remainingToSettle;
        if (actuallySettledCredit > 0) {
          await prisma.payment.create({
            data: {
              customerId: visit.customerId,
              amount: actuallySettledCredit,
              method: paymentMethod || 'Cash',
              type: 'credit_settlement'
            }
          });
        }
      }
    }

    const totalPaid = priorPaid + (newPayment ? newPayment.amount : 0);
    const remainingBalance = Math.max(0, visitTotal - totalPaid);

    // 4. Record credit (unpaid amount) if any - WITH STRICT WALK-IN CREDIT SHIELD
    let recordedCredit = 0;
    if (remainingBalance > 0) {
      // Check if customer is an unregistered walk-in (starts with WALK- or has no valid 10-digit phone)
      const customerPhone = visit.customer?.phone || '';
      if (customerPhone.startsWith('WALK-') || customerPhone.replace(/\D/g, '').length < 10) {
        return res.status(400).json({
          error: `Credit (Udhar) cannot be extended to an unregistered walk-in customer (${visit.customer?.name || 'Customer'}). Please register this customer with their 10-digit mobile number before extending credit, or settle the remaining balance of ₹${remainingBalance.toFixed(2)} in full via Cash or UPI.`
        });
      }

      recordedCredit = remainingBalance;
      await prisma.creditRecord.create({
        data: {
          customerId: visit.customerId,
          visitId: visit.id,
          amount: recordedCredit,
          settledAmount: 0,
          status: 'unpaid',
          notes: notes || `Outstanding balance from visit on ${now.toLocaleDateString('en-IN')}`
        }
      });
    }

    // 5. Update Visit record
    const paymentStatus = remainingBalance === 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'credit');
    const updatedVisit = await prisma.visit.update({
      where: { id: visitId },
      data: {
        endTime: now,
        status: 'completed',
        itemsTotal,
        tablesTotal,
        visitTotal,
        paidAmount: totalPaid,
        balanceDue: remainingBalance,
        paymentStatus
      },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      }
    });

    // 6. Update Customer Lifetime Totals & Live Credit Due
    const customerStats = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(SUM(cr.amount - cr."settledAmount"), 0) as current_credit_due,
        COALESCE((SELECT SUM("visitTotal") FROM "Visit" WHERE "customerId" = ${visit.customerId}), 0) as lifetime_spend,
        COALESCE((SELECT SUM(amount) FROM "Payment" WHERE "customerId" = ${visit.customerId}), 0) as lifetime_paid
      FROM "CreditRecord" cr
      WHERE cr."customerId" = ${visit.customerId} AND cr.status = 'unpaid'
    `;

    if (customerStats && customerStats.length > 0) {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: {
          currentCreditDue: Number(customerStats[0].current_credit_due) || 0,
          lifetimeSpend: Number(customerStats[0].lifetime_spend) || 0,
          lifetimePaid: Number(customerStats[0].lifetime_paid) || 0
        }
      });
    }

    broadcast({ type: 'VISIT_CLOSE', visit: updatedVisit, session: updatedVisit });
    res.json(updatedVisit);
  } catch (error: any) {
    console.error('Error closing visit:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8b. POST /api/visits/:id/settle-unsettled - Settle an unsettled auto-closed visit with Cash/UPI
router.post('/:id/settle-unsettled', authenticateToken, async (req, res) => {
  const visitId = req.params.id;
  const { paymentAmount, paymentMethod } = req.body;
  const numPay = parseFloat(paymentAmount);

  if (isNaN(numPay) || numPay <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { payments: true, customer: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Record payment
    await prisma.payment.create({
      data: {
        customerId: visit.customerId,
        visitId: visit.id,
        amount: numPay,
        method: paymentMethod || 'Cash',
        type: 'visit_payment'
      }
    });

    // Recompute visit totals
    const allPayments = await prisma.payment.findMany({ where: { visitId: visit.id } });
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = Math.max(0, visit.visitTotal - totalPaid);
    const paymentStatus = balanceDue === 0 ? 'paid' : 'partially_paid';

    const updatedVisit = await prisma.visit.update({
      where: { id: visit.id },
      data: {
        paidAmount: totalPaid,
        balanceDue,
        paymentStatus
      },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      }
    });

    // Update customer lifetime stats
    const customerStats = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(SUM(cr.amount - cr."settledAmount"), 0) as current_credit_due,
        COALESCE((SELECT SUM("visitTotal") FROM "Visit" WHERE "customerId" = ${visit.customerId}), 0) as lifetime_spend,
        COALESCE((SELECT SUM(amount) FROM "Payment" WHERE "customerId" = ${visit.customerId}), 0) as lifetime_paid
      FROM "CreditRecord" cr
      WHERE cr."customerId" = ${visit.customerId} AND cr.status = 'unpaid'
    `;

    if (customerStats && customerStats.length > 0) {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: {
          currentCreditDue: Number(customerStats[0].current_credit_due) || 0,
          lifetimeSpend: Number(customerStats[0].lifetime_spend) || 0,
          lifetimePaid: Number(customerStats[0].lifetime_paid) || 0
        }
      });
    }

    broadcast({ type: 'VISIT_UPDATE', visit: updatedVisit });
    res.json(updatedVisit);
  } catch (err: any) {
    console.error('Error settling unsettled visit:', err);
    res.status(500).json({ error: err.message || 'Failed to settle visit' });
  }
});

// 8c. POST /api/visits/:id/mark-loss - Mark an unpaid walk-in visit as written-off loss
router.post('/:id/mark-loss', authenticateToken, async (req, res) => {
  const visitId = req.params.id;

  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { customer: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const updatedVisit = await prisma.visit.update({
      where: { id: visit.id },
      data: {
        paymentStatus: 'loss',
        balanceDue: 0
      },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      }
    });

    // Remove any CreditRecord for this visit
    await prisma.creditRecord.deleteMany({
      where: { visitId: visit.id }
    });

    // Recalculate customer credit due
    const customerStats = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(SUM(cr.amount - cr."settledAmount"), 0) as current_credit_due,
        COALESCE((SELECT SUM("visitTotal") FROM "Visit" WHERE "customerId" = ${visit.customerId}), 0) as lifetime_spend,
        COALESCE((SELECT SUM(amount) FROM "Payment" WHERE "customerId" = ${visit.customerId}), 0) as lifetime_paid
      FROM "CreditRecord" cr
      WHERE cr."customerId" = ${visit.customerId} AND cr.status = 'unpaid'
    `;

    if (customerStats && customerStats.length > 0) {
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: {
          currentCreditDue: Number(customerStats[0].current_credit_due) || 0,
          lifetimeSpend: Number(customerStats[0].lifetime_spend) || 0,
          lifetimePaid: Number(customerStats[0].lifetime_paid) || 0
        }
      });
    }

    broadcast({ type: 'VISIT_UPDATE', visit: updatedVisit });
    res.json(updatedVisit);
  } catch (err: any) {
    console.error('Error marking visit as loss:', err);
    res.status(500).json({ error: err.message || 'Failed to mark visit as loss' });
  }
});

// 9. Quick Sale (Direct cafe counter sale)
router.post('/quick-sale', authenticateToken, async (req: any, res) => {
  const { customerName, customerPhone, items, paymentMethod, staffUsername } = req.body;
  const staff = staffUsername || req.user?.username || 'chirag';

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order items are required' });
  }

  try {
    // 1. Resolve customer
    let customer: any = null;
    if (customerPhone && customerPhone.trim().length >= 10) {
      customer = await prisma.customer.findUnique({ where: { phone: customerPhone.trim() } });
    }
    if (!customer && customerName) {
      customer = await prisma.customer.findFirst({
        where: { name: { equals: customerName.trim(), mode: 'insensitive' } }
      });
    }
    if (!customer) {
      const cleanName = (customerName || 'Walk-in Counter Guest').trim();
      const parts = cleanName.split(/\s+/);
      const cleanPhone = (customerPhone && customerPhone.trim().length >= 10)
        ? customerPhone.trim()
        : `QUICK-${Date.now().toString().slice(-6)}`;

      customer = await prisma.customer.create({
        data: {
          firstName: parts[0] || cleanName,
          lastName: parts.slice(1).join(' ') || '',
          name: cleanName,
          phone: cleanPhone
        }
      });
    }

    // 2. Fetch menu items
    const itemIds = items.map(i => parseInt(i.menuItemId));
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: itemIds } } });
    const menuMap = new Map(menuItems.map(m => [m.id, m]));

    let itemsTotal = 0;
    const orderData = items.map(item => {
      const m = menuMap.get(parseInt(item.menuItemId));
      if (!m) throw new Error(`Menu item ${item.menuItemId} not found`);
      const qty = parseInt(item.quantity) || 1;
      itemsTotal += m.price * qty;
      return {
        menuItemId: m.id,
        quantity: qty,
        price: m.price
      };
    });

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const visitId = `QS_${timestamp}_${customer.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const visit = await prisma.visit.create({
      data: {
        id: visitId,
        customerId: customer.id,
        staffUsername: staff.toLowerCase(),
        startTime: now,
        endTime: now,
        status: 'completed',
        itemsTotal,
        tablesTotal: 0,
        visitTotal: itemsTotal,
        paidAmount: itemsTotal,
        balanceDue: 0,
        paymentStatus: 'paid',
        orders: {
          create: orderData
        },
        payments: {
          create: {
            customerId: customer.id,
            amount: itemsTotal,
            method: paymentMethod || 'Cash',
            type: 'visit_payment'
          }
        }
      },
      include: {
        customer: true,
        orders: { include: { menuItem: true } },
        payments: true
      }
    });

    // Update customer lifetime stats
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        lifetimeSpend: { increment: itemsTotal },
        lifetimePaid: { increment: itemsTotal },
        totalVisits: { increment: 1 }
      }
    });

    // Auto-deduct inventory stock for quick-order items
    try {
      for (const item of items) {
        const mId = parseInt(item.menuItemId);
        const qty = parseInt(item.quantity) || 1;
        const invItem = await prisma.inventoryItem.findUnique({
          where: { menuItemId: mId }
        });
        if (invItem && qty > 0) {
          const newStock = Math.max(0, invItem.currentStock - qty);
          await prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: newStock }
          });
          await prisma.inventoryTransaction.create({
            data: {
              itemId: invItem.id,
              type: 'SALE',
              quantity: -qty,
              piecesPerBox: invItem.piecesPerBox,
              stockBefore: invItem.currentStock,
              stockAfter: newStock,
              notes: `Quick Sale Order for Visit ${visitId}`,
              staffUsername: staff.toLowerCase()
            }
          });
        }
      }
    } catch (invErr) {
      console.error('Failed to deduct inventory for quick-order:', invErr);
    }

    const responsePayload = {
      ...visit,
      totalBill: visit.visitTotal,
      customerName: customer.name,
      customerPhone: customer.phone.startsWith('QUICK-') ? null : customer.phone
    };

    broadcast({ type: 'QUICK_SALE', visit: responsePayload, session: responsePayload });
    res.status(201).json(responsePayload);
  } catch (error: any) {
    console.error('Error processing quick sale:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. Seamlessly transfer active table play to another table
router.post('/:id/switch-table', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { toTableId } = req.body;

    if (!toTableId) {
      return res.status(400).json({ error: 'Target table (toTableId) is required' });
    }

    const targetTableId = parseInt(toTableId);

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        tablePlays: {
          include: { table: true }
        }
      }
    });

    if (!visit || visit.status !== 'active') {
      return res.status(404).json({ error: 'Active visit not found' });
    }

    const targetTable = await prisma.table.findUnique({
      where: { id: targetTableId }
    });

    if (!targetTable) {
      return res.status(404).json({ error: 'Target table does not exist' });
    }

    const activePlayOnTarget = await prisma.tablePlay.findFirst({
      where: { tableId: parseInt(toTableId), endTime: null }
    });
    if (activePlayOnTarget) {
      return res.status(400).json({ error: `Table ${targetTable.number} is currently occupied` });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Close running table play
      const runningPlay = visit.tablePlays.find(tp => !tp.endTime);
      if (runningPlay) {
        const start = new Date(runningPlay.startTime);
        const durationHours = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60));
        const rate = getPlayHourlyRate(runningPlay);
        const cost = durationHours * rate;

        await tx.tablePlay.update({
          where: { id: runningPlay.id },
          data: {
            endTime: now,
            cost: Math.round(cost * 100) / 100
          }
        });

        if (runningPlay.tableId) {
          await tx.table.update({
            where: { id: runningPlay.tableId },
            data: { status: 'available' }
          });
        }
      }

      // 2. Mark new table occupied
      await tx.table.update({
        where: { id: targetTableId },
        data: { status: 'occupied' }
      });

      // 3. Start new table play
      await tx.tablePlay.create({
        data: {
          visitId: visit.id,
          tableId: targetTableId,
          gameType: targetTable.gameType,
          playerCount: 1,
          startTime: now,
          createdBy: req.user?.username || visit.staffUsername
        }
      });
    });

    const updated = await prisma.visit.findUnique({
      where: { id },
      include: {
        customer: true,
        tablePlays: { include: { table: true } },
        orders: { include: { menuItem: true } },
        payments: true,
        creditRecords: true
      }
    });

    broadcast({ type: 'TABLE_SWITCHED', data: updated, session: updated });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Send WhatsApp receipt invoice
router.post('/:id/send-whatsapp', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            creditRecords: { where: { status: 'unpaid' } }
          }
        },
        orders: { include: { menuItem: true } },
        tablePlays: { include: { table: true } },
        payments: true,
        creditRecords: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (!visit.customer?.phone) {
      return res.status(400).json({ error: 'Customer phone number is missing for this visit.' });
    }

    let phone = visit.customer.phone.replace(/[^0-9]/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    const menuCost = visit.orders.reduce((s, o) => s + o.quantity * o.price, 0);
    const gameCost = visit.tablePlays.reduce((s, tp) => s + tp.cost, 0);
    const visitTotal = visit.visitTotal || (menuCost + gameCost + visit.customAmount);
    const amountPaid = visit.payments.reduce((s, p) => s + p.amount, 0);
    const currentCreditDue = visit.customer.currentCreditDue || 0;

    let msg = `*REBOUND CAFE & BILLIARDS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🧾 *VISIT RECEIPT SUMMARY*\n`;
    msg += `👤 *Customer:* ${visit.customer.name}\n`;
    msg += `📱 *Phone:* ${visit.customer.phone}\n`;
    msg += `📅 *Date:* ${new Date(visit.startTime).toLocaleDateString('en-IN')} ${new Date(visit.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (visit.orders.length > 0) {
      msg += `☕ *CAFE & REFRESHMENTS*\n`;
      visit.orders.forEach(o => {
        msg += `• ${o.menuItem?.name || 'Item'} × ${o.quantity} = ₹${(o.quantity * o.price).toFixed(2)}\n`;
      });
      msg += `\n`;
    }

    if (visit.tablePlays.length > 0) {
      msg += `🎱 *BILLIARDS & GAMES*\n`;
      visit.tablePlays.forEach(tp => {
        const label = tp.gameType === 'PS4'
          ? `PS4 (${tp.playerCount} Players)`
          : `${tp.gameType}${tp.table ? ` (Table ${tp.table.number})` : ''}`;
        msg += `• ${label} = ₹${tp.cost.toFixed(2)}\n`;
      });
      msg += `\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Current Visit Total:* ₹${visitTotal.toFixed(2)}\n`;
    if (amountPaid > 0) {
      msg += `💳 *Paid:* -₹${amountPaid.toFixed(2)}\n`;
    }
    if (visit.balanceDue > 0) {
      msg += `⚠️ *Current Visit Balance:* ₹${visit.balanceDue.toFixed(2)}\n`;
    }
    if (currentCreditDue > 0) {
      msg += `🔴 *Total Outstanding Credit:* ₹${currentCreditDue.toFixed(2)}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Thank you for visiting Rebound Cafe & Billiards! Hope to see you again soon! 🙏✨`;

    // Try cloud / twilio / generic dispatch if configured
    const cloudToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (cloudToken && phoneId) {
      await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: msg }
        })
      });
    }

    res.json({ success: true, message: 'Receipt prepared', receiptText: msg, phone });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Manual / Admin trigger for Nightly 02:00 AM Auto-Close
router.post('/auto-close-nightly', authenticateToken, async (req, res) => {
  try {
    const { cutoffDate } = req.body;
    const result = await runNightlyAutoClose(cutoffDate ? new Date(cutoffDate) : undefined);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
