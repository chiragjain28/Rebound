import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

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

// 4. Get single visit by ID
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

    res.json(visit);
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
      if (table.status === 'occupied') {
        return res.status(400).json({ error: `Table ${table.number} is already occupied` });
      }
    }

    const playType = gameType || table?.gameType || 'Pool';
    const now = new Date();

    const [tablePlay, updatedTable] = await prisma.$transaction([
      prisma.tablePlay.create({
        data: {
          visitId,
          tableId: table ? table.id : null,
          gameType: playType,
          playerCount: parseInt(playerCount) || 1,
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

    const endTime = new Date();
    const durationMinutes = Math.max(1, (endTime.getTime() - new Date(play.startTime).getTime()) / 60000);
    const hourlyRate = GAME_RATES[play.gameType] || 160;

    let finalCost = overrideCost !== undefined ? parseFloat(overrideCost) : 0;
    if (overrideCost === undefined) {
      if (play.gameType === 'PS4') {
        finalCost = Math.round((durationMinutes / 60) * hourlyRate * (play.playerCount || 1));
      } else {
        finalCost = Math.round((durationMinutes / 60) * hourlyRate);
      }
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
        const hourlyRate = GAME_RATES[play.gameType] || 160;
        const playCost = play.gameType === 'PS4'
          ? Math.round((durationMinutes / 60) * hourlyRate * (play.playerCount || 1))
          : Math.round((durationMinutes / 60) * hourlyRate);

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

    // 3. Record new payment if provided
    let newPayment = null;
    const numPay = parseFloat(paymentAmount);
    if (!isNaN(numPay) && numPay > 0) {
      newPayment = await prisma.payment.create({
        data: {
          customerId: visit.customerId,
          visitId: visit.id,
          amount: numPay,
          method: paymentMethod || 'Cash',
          type: 'visit_payment'
        }
      });
    }

    const totalPaid = visit.payments.reduce((sum, p) => sum + p.amount, 0) + (newPayment ? newPayment.amount : 0);
    const remainingBalance = Math.max(0, visitTotal - totalPaid);

    // 4. Record credit (unpaid amount) if any
    let recordedCredit = 0;
    if (remainingBalance > 0) {
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

    broadcast({ type: 'QUICK_SALE', visit, session: visit });
    res.status(201).json(visit);
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
        tablePlays: true
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

    if (targetTable.status === 'occupied') {
      return res.status(400).json({ error: `Table ${targetTable.number} is currently occupied` });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Close running table play
      const runningPlay = visit.tablePlays.find(tp => !tp.endTime);
      if (runningPlay) {
        const start = new Date(runningPlay.startTime);
        const durationHours = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60));
        const rate = GAME_RATES[runningPlay.gameType] || 0;
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

export default router;
