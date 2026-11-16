import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const dateQuery = ((req.query.date as string) || '').trim();
    let targetDate = new Date();
    if (dateQuery) {
      targetDate = new Date(dateQuery);
    }
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [tables, activePlays, bookings, unpaidCredits] = await Promise.all([
      prisma.table.findMany({
        orderBy: [
          { gameType: 'asc' },
          { number: 'asc' }
        ]
      }),
      prisma.tablePlay.findMany({
        where: { endTime: null },
        include: {
          table: true,
          visit: {
            include: {
              customer: true,
              orders: {
                include: { menuItem: true }
              }
            }
          }
        },
        orderBy: { startTime: 'asc' }
      }),
      prisma.tableBooking.findMany({
        orderBy: { bookingTime: 'asc' },
        include: { table: true }
      }),
      prisma.creditRecord.findMany({
        where: { status: 'unpaid' }
      })
    ]);

    // Auto-heal & reconcile table status with active plays (source of truth)
    const activeTableIds = new Set(activePlays.map(tp => tp.tableId).filter(Boolean));
    for (const t of tables) {
      const shouldBeOccupied = activeTableIds.has(t.id);
      if ((t.status === 'occupied') !== shouldBeOccupied) {
        t.status = shouldBeOccupied ? 'occupied' : 'available';
        prisma.table.update({
          where: { id: t.id },
          data: { status: t.status }
        }).catch(err => console.error(`Error auto-healing table ${t.id}:`, err));
      }
    }

    const formattedActivePlays = activePlays.map(tp => {
      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(tp.startTime).getTime()) / 60000));
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      const rate = tp.table?.ratePerHour || (tp.table?.gameType === 'MidSnooker' ? 220 : 160);
      const runningCost = Math.round((elapsedMinutes / 60) * rate * 100) / 100;

      return {
        id: tp.id,
        visitId: tp.visitId,
        tableId: tp.tableId,
        gameType: tp.gameType,
        stationName: tp.table?.name || (tp.table ? `${tp.table.gameType} Table ${tp.table.number}` : (tp.gameType === 'PS4' ? 'PS4 Station' : tp.gameType)),
        tableNumber: tp.table?.number,
        startTime: tp.startTime,
        durationStr,
        elapsedMinutes,
        runningCost,
        ratePerHour: rate,
        customerName: tp.visit?.customer?.name || 'Walk-in',
        customerPhone: tp.visit?.customer?.phone || '',
        customerId: tp.visit?.customer?.id,
        currentCreditDue: tp.visit?.customer?.currentCreditDue || 0,
        ordersCount: tp.visit?.orders?.length || 0,
        orders: tp.visit?.orders || []
      };
    });

    res.json({
      tables,
      activePlays: formattedActivePlays,
      activePlaysCount: formattedActivePlays.length,
      bookings
    });
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      orderBy: { number: 'asc' }
    });
    res.json(tables);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/analytics - Comprehensive sales, revenue & customer retention breakdown
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const range = (req.query.range as string) || '30days';
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOf30Days = new Date(now);
    startOf30Days.setDate(now.getDate() - 30);
    startOf30Days.setHours(0, 0, 0, 0);

    let startDate = new Date();
    let endDate = new Date();
    let daysInRange = 30;
    let periodLabel = 'Last 30 Days';

    if (req.query.date) {
      // Specific date format: YYYY-MM-DD
      const dateStr = req.query.date as string;
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3) {
        startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
        daysInRange = 1;
        periodLabel = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } else if (req.query.month) {
      // Specific month format: YYYY-MM
      const monthStr = req.query.month as string;
      const parts = monthStr.split('-').map(Number);
      if (parts.length === 2) {
        startDate = new Date(parts[0], parts[1] - 1, 1, 0, 0, 0, 0);
        endDate = new Date(parts[0], parts[1], 0, 23, 59, 59, 999);
        daysInRange = endDate.getDate();
        periodLabel = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }
    } else {
      if (range === 'today') {
        startDate = new Date(startOfDay);
        endDate = new Date();
        daysInRange = 1;
        periodLabel = 'Today';
      } else if (range === '7days') {
        startDate = new Date(startOfWeek);
        endDate = new Date();
        daysInRange = 7;
        periodLabel = 'Last 7 Days';
      } else if (range === 'month') {
        startDate = new Date(startOfMonth);
        endDate = new Date();
        daysInRange = Math.max(1, now.getDate());
        periodLabel = 'This Month';
      } else {
        startDate = new Date(startOf30Days);
        endDate = new Date();
        daysInRange = 30;
        periodLabel = 'Last 30 Days';
      }
    }

    // Benchmark boundary to ensure accurate daily, weekly, monthly active table hours
    const benchmarkStart = new Date(Math.min(
      startDate.getTime(),
      startOf30Days.getTime(),
      startOfMonth.getTime(),
      startOfWeek.getTime(),
      startOfDay.getTime()
    ));

    const [completedVisits, legacySessions, payments, benchmarkTablePlays, benchmarkLegacySessions] = await Promise.all([
      prisma.visit.findMany({
        where: {
          status: 'completed',
          startTime: { gte: startDate, lte: endDate }
        },
        include: {
          customer: true,
          tablePlays: {
            include: { table: true }
          },
          orders: {
            include: { menuItem: true }
          },
          payments: true,
          creditRecords: true
        },
        orderBy: { startTime: 'desc' }
      }),
      prisma.legacySession.findMany({
        where: {
          startTime: { gte: startDate, lte: endDate }
        },
        orderBy: { startTime: 'desc' }
      }),
      prisma.payment.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.tablePlay.findMany({
        where: {
          startTime: { gte: benchmarkStart },
          endTime: { not: null }
        },
        include: { table: true }
      }),
      prisma.legacySession.findMany({
        where: {
          startTime: { gte: benchmarkStart }
        },
        select: { startTime: true, endTime: true, tablePlays: true }
      })
    ]);

    // Duration calculation helper: only count finalized/completed plays.
    // If a game is currently running (no endTime), it is NOT counted until it ends.
    function getPlayDurationHours(start: Date | string, end?: Date | string | null): number {
      if (!start || !end) return 0;
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      const diff = (e - s) / (1000 * 60 * 60);
      return (diff > 0 && diff < 16) ? diff : (diff >= 16 ? 4 : 0);
    }

    function normalizeGameType(gt?: string | null): 'Pool' | 'MidSnooker' | 'PS4' | 'Other' {
      const s = (gt || '').toLowerCase();
      if (s.includes('snooker')) return 'MidSnooker';
      if (s.includes('ps4') || s.includes('ps5') || s.includes('playstation')) return 'PS4';
      if (s.includes('pool')) return 'Pool';
      return 'Other';
    }

    // Benchmark all table plays across systems
    interface AggPlay {
      startTime: Date;
      hours: number;
      gameType: 'Pool' | 'MidSnooker' | 'PS4' | 'Other';
    }
    const allBenchmarkPlays: AggPlay[] = [];

    for (const tp of benchmarkTablePlays) {
      if (!tp.endTime) continue;
      const hours = getPlayDurationHours(tp.startTime, tp.endTime);
      if (hours > 0) {
        allBenchmarkPlays.push({
          startTime: new Date(tp.startTime),
          hours,
          gameType: normalizeGameType(tp.gameType || tp.table?.gameType)
        });
      }
    }

    for (const ls of benchmarkLegacySessions) {
      const plays = Array.isArray(ls.tablePlays) ? (ls.tablePlays as any[]) : [];
      for (const tp of plays) {
        if (!tp.startTime || !tp.endTime) continue;
        const hours = getPlayDurationHours(tp.startTime, tp.endTime);
        if (hours > 0) {
          allBenchmarkPlays.push({
            startTime: new Date(tp.startTime),
            hours,
            gameType: normalizeGameType(tp.gameType || tp.tableName)
          });
        }
      }
    }

    const calcHoursForPeriod = (since: Date) => {
      const filtered = allBenchmarkPlays.filter(p => p.startTime >= since);
      return filtered.reduce((acc, p) => acc + p.hours, 0);
    };

    const todayHours = calcHoursForPeriod(startOfDay);
    const weekHours = calcHoursForPeriod(startOfWeek);
    const monthHours = calcHoursForPeriod(startOfMonth);

    // Filtered range active table hours & breakdown
    const periodPlays = allBenchmarkPlays.filter(p => p.startTime >= startDate && p.startTime <= endDate);
    const periodHours = periodPlays.reduce((acc, p) => acc + p.hours, 0);
    const byGameType = {
      pool: 0,
      midSnooker: 0,
      ps4: 0,
      other: 0
    };

    for (const p of periodPlays) {
      if (p.gameType === 'Pool') byGameType.pool += p.hours;
      else if (p.gameType === 'MidSnooker') byGameType.midSnooker += p.hours;
      else if (p.gameType === 'PS4') byGameType.ps4 += p.hours;
      else byGameType.other += p.hours;
    }

    const dailyAverageHours = daysInRange > 0 ? periodHours / daysInRange : 0;

    let tableRevenue = 0;
    let cafeRevenue = 0;
    let drinksRevenue = 0;
    let cigarettesRevenue = 0;
    let otherMenuRevenue = 0;

    const itemSalesMap = new Map<string, { name: string; category: string; quantity: number; revenue: number }>();
    const customerPhoneSet = new Set<string>();
    const dailyMap = new Map<string, { date: string; rawDate: Date; tableRev: number; menuRev: number; total: number; tickets: number; tableHours: number }>();

    function getOrCreateDay(dStr: string, rawDate: Date) {
      if (!dailyMap.has(dStr)) {
        dailyMap.set(dStr, {
          date: dStr,
          rawDate,
          tickets: 0,
          tableRev: 0,
          menuRev: 0,
          total: 0,
          tableHours: 0
        });
      }
      return dailyMap.get(dStr)!;
    }

    // 1. Process Modern Visits
    for (const v of completedVisits) {
      if (v.customer?.phone) {
        customerPhoneSet.add(v.customer.phone.trim());
      }

      tableRevenue += v.tablesTotal || 0;

      const rawDate = new Date(v.startTime);
      const dStr = rawDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const day = getOrCreateDay(dStr, rawDate);
      day.tickets += 1;
      day.tableRev += (v.tablesTotal || 0);
      day.menuRev += (v.itemsTotal || 0);
      day.total += (v.visitTotal || ((v.tablesTotal || 0) + (v.itemsTotal || 0) + (v.customAmount || 0)));

      for (const tp of v.tablePlays) {
        day.tableHours += getPlayDurationHours(tp.startTime, tp.endTime);
      }

      for (const o of v.orders) {
        const cat = o.menuItem?.category?.toLowerCase() || '';
        const orderRev = o.price * o.quantity;

        if (cat.includes('cafe')) {
          cafeRevenue += orderRev;
        } else if (cat.includes('drink') || cat.includes('cold')) {
          drinksRevenue += orderRev;
        } else if (cat.includes('cigar')) {
          cigarettesRevenue += orderRev;
        } else {
          otherMenuRevenue += orderRev;
        }

        const itemName = o.menuItem?.name || 'Unknown Item';
        const existing = itemSalesMap.get(itemName) || {
          name: itemName,
          category: o.menuItem?.category || 'General',
          quantity: 0,
          revenue: 0
        };
        existing.quantity += o.quantity;
        existing.revenue += orderRev;
        itemSalesMap.set(itemName, existing);
      }
    }

    // 2. Process Legacy Sessions in range
    for (const ls of legacySessions) {
      if (ls.customerPhone) {
        customerPhoneSet.add(ls.customerPhone.trim());
      }

      tableRevenue += ls.tablesTotal || 0;

      const rawDate = new Date(ls.startTime);
      const dStr = rawDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const day = getOrCreateDay(dStr, rawDate);
      day.tickets += 1;
      day.tableRev += (ls.tablesTotal || 0);
      day.menuRev += (ls.itemsTotal || 0);
      day.total += (ls.totalBill || ((ls.tablesTotal || 0) + (ls.itemsTotal || 0) + (ls.customAmount || 0)));

      const plays = Array.isArray(ls.tablePlays) ? (ls.tablePlays as any[]) : [];
      for (const tp of plays) {
        day.tableHours += getPlayDurationHours(tp.startTime, tp.endTime);
      }

      const orders = Array.isArray(ls.orders) ? (ls.orders as any[]) : [];
      for (const o of orders) {
        const cat = (o.category || '').toLowerCase();
        const orderRev = (o.price || 0) * (o.quantity || 1);

        if (cat.includes('cafe')) {
          cafeRevenue += orderRev;
        } else if (cat.includes('drink') || cat.includes('cold')) {
          drinksRevenue += orderRev;
        } else if (cat.includes('cigar')) {
          cigarettesRevenue += orderRev;
        } else {
          otherMenuRevenue += orderRev;
        }

        const itemName = o.name || 'Unknown Item';
        const existing = itemSalesMap.get(itemName) || {
          name: itemName,
          category: o.category || 'General',
          quantity: 0,
          revenue: 0
        };
        existing.quantity += (o.quantity || 1);
        existing.revenue += orderRev;
        itemSalesMap.set(itemName, existing);
      }
    }

    const totalRevenue = tableRevenue + cafeRevenue + drinksRevenue + cigarettesRevenue + otherMenuRevenue;
    
    // Payment split (Cash vs UPI)
    let cash = 0;
    let upi = 0;
    for (const p of payments) {
      const method = (p.method || '').toLowerCase();
      if (
        method.includes('upi') ||
        method.includes('qr') ||
        method.includes('online') ||
        method.includes('gpay') ||
        method.includes('phonepe') ||
        method.includes('paytm')
      ) {
        upi += p.amount;
      } else {
        cash += p.amount;
      }
    }
    const totalCollected = cash + upi;

    // Customer metrics
    const [totalRegistered, newInPeriod] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: { createdAt: { gte: startDate } }
      })
    ]);

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .map(d => ({
        date: d.date,
        isoDate: `${d.rawDate.getFullYear()}-${String(d.rawDate.getMonth() + 1).padStart(2, '0')}-${String(d.rawDate.getDate()).padStart(2, '0')}`,
        tickets: d.tickets,
        tableRev: Math.round(d.tableRev),
        menuRev: Math.round(d.menuRev),
        total: Math.round(d.total),
        tableHours: Number(d.tableHours.toFixed(1))
      }));

    const topItems = Array.from(itemSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const categoryRevenue = {
      billiards: tableRevenue,
      cafe: cafeRevenue,
      drinks: drinksRevenue,
      cigarettes: cigarettesRevenue,
      other: otherMenuRevenue
    };

    const totalVisitsCount = completedVisits.length + legacySessions.length;

    res.json({
      range,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalBilled: totalRevenue,
      totalCollected,
      totalRevenue,
      totalPaymentsReceived: totalCollected,
      totalTicketsCount: totalVisitsCount,
      totalVisits: totalVisitsCount,
      totalSessions: totalVisitsCount,
      uniqueCustomers: customerPhoneSet.size,
      paymentSplit: {
        cash,
        upi
      },
      categoryRevenue,
      categoryBreakdown: {
        tables: tableRevenue,
        cafe: cafeRevenue,
        coldDrinks: drinksRevenue,
        cigarettes: cigarettesRevenue,
        other: otherMenuRevenue
      },
      customerStats: {
        totalRegistered,
        newInPeriod,
        activeInPeriod: customerPhoneSet.size
      },
      tableHoursStats: {
        todayHours: Number(todayHours.toFixed(1)),
        weekHours: Number(weekHours.toFixed(1)),
        monthHours: Number(monthHours.toFixed(1)),
        periodHours: Number(periodHours.toFixed(1)),
        periodGamesCount: periodPlays.length,
        dailyAverageHours: Number(dailyAverageHours.toFixed(1)),
        byGameType: {
          pool: Number(byGameType.pool.toFixed(1)),
          midSnooker: Number(byGameType.midSnooker.toFixed(1)),
          ps4: Number(byGameType.ps4.toFixed(1)),
          other: Number(byGameType.other.toFixed(1))
        }
      },
      topItems,
      topSellingItems: topItems,
      dailyTrend
    });
  } catch (error: any) {
    console.error('Error in dashboard analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
