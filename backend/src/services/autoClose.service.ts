import { prisma } from '../index';
import { broadcast } from '../websocket';

// Game hourly rates (₹ per hour)
const GAME_RATES: Record<string, number> = {
  'Pool': 160,
  'MidSnooker': 220,
  'PS4': 80,
  'None': 0,
};

/**
 * Computes the 02:00 AM operational day cutoff for any timestamp.
 * - If referenceDate is between 12:00 AM and 01:59:59 AM, cutoff is 02:00 AM on that same calendar day.
 * - If referenceDate is at or after 02:00 AM, cutoff is 02:00 AM on the NEXT calendar day.
 */
export function getOperational2AMCutoff(referenceDate: Date): Date {
  const d = new Date(referenceDate);
  const hour = d.getHours();
  const cutoff = new Date(d);
  if (hour < 2) {
    cutoff.setHours(2, 0, 0, 0);
  } else {
    cutoff.setDate(cutoff.getDate() + 1);
    cutoff.setHours(2, 0, 0, 0);
  }
  return cutoff;
}

/**
 * Auto-closes any active visits that started before or at the 02:00 AM cutoff.
 * If no cutoff is passed, closes all currently active visits.
 * 
 * IMPORTANT: Table plays and visits are strictly capped at their 02:00 AM operational cutoff,
 * preventing accidental billing across sleep/standby periods or afternoon restarts.
 */
export async function runNightlyAutoClose(cutoffDate?: Date): Promise<{ closedCount: number; details: any[] }> {
  const now = new Date();
  const effectiveCutoff = cutoffDate || now;

  console.log(`[AUTO-CLOSE] Running nightly auto-close for visits active as of ${effectiveCutoff.toISOString()}`);

  // Find all active visits started before or at cutoff
  const activeVisits = await prisma.visit.findMany({
    where: {
      status: 'active',
      ...(cutoffDate ? { startTime: { lte: cutoffDate } } : {})
    },
    include: {
      customer: true,
      orders: true,
      tablePlays: { include: { table: true } },
      payments: true,
      creditRecords: true
    }
  });

  if (activeVisits.length === 0) {
    console.log('[AUTO-CLOSE] No active visits found to auto-close.');
    return { closedCount: 0, details: [] };
  }

  const closedDetails: any[] = [];

  for (const visit of activeVisits) {
    try {
      console.log(`[AUTO-CLOSE] Processing visit ${visit.id} for customer ${visit.customer?.name} (#${visit.customerId})`);

      // Determine the 02:00 AM operational closing time for this visit
      const visitStart = new Date(visit.startTime);
      const visitOperationalCutoff = getOperational2AMCutoff(visitStart);
      const visitEndTime = cutoffDate
        ? new Date(Math.min(cutoffDate.getTime(), visitOperationalCutoff.getTime()))
        : (visitOperationalCutoff.getTime() <= now.getTime() ? visitOperationalCutoff : now);

      // 1. End any active table plays
      for (const play of visit.tablePlays) {
        if (!play.endTime) {
          const playStart = new Date(play.startTime);
          const playOperationalCutoff = getOperational2AMCutoff(playStart);
          
          // Table play end time MUST NOT exceed its 02:00 AM operational cutoff
          const playEndTime = cutoffDate
            ? new Date(Math.min(cutoffDate.getTime(), playOperationalCutoff.getTime()))
            : (playOperationalCutoff.getTime() <= now.getTime() ? playOperationalCutoff : now);

          const durationMinutes = Math.max(1, Math.round((playEndTime.getTime() - playStart.getTime()) / 60000));
          const hourlyRate = (play as any)?.table?.ratePerHour || GAME_RATES[play.gameType] || 160;
          const playCost = play.gameType === 'PS4'
            ? Math.round((durationMinutes / 60) * hourlyRate * (play.playerCount || 1))
            : Math.round((durationMinutes / 60) * hourlyRate);

          await prisma.tablePlay.update({
            where: { id: play.id },
            data: { endTime: playEndTime, cost: playCost }
          });

          if (play.tableId) {
            await prisma.table.update({
              where: { id: play.tableId },
              data: { status: 'available' }
            });
            broadcast({ type: 'TABLE_UPDATE', table: { id: play.tableId, status: 'available' } });
          }
        }
      }

      // 2. Re-fetch all plays to get accurate final tablesTotal
      const allPlays = await prisma.tablePlay.findMany({ where: { visitId: visit.id } });
      const tablesTotal = allPlays.reduce((sum, p) => sum + p.cost, 0);
      const itemsTotal = visit.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
      const visitTotal = Math.round((itemsTotal + tablesTotal + visit.customAmount) * 100) / 100;
      const totalPaid = visit.payments.reduce((sum, p) => sum + p.amount, 0);
      const remainingUnpaid = Math.max(0, Math.round((visitTotal - totalPaid) * 100) / 100);

      // 3. If there is an unpaid balance, record a CreditRecord (Udhar) for this customer & visit
      let creditRecordId: number | null = null;
      if (remainingUnpaid > 0) {
        const dateStr = visitEndTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const cr = await prisma.creditRecord.create({
          data: {
            customerId: visit.customerId,
            visitId: visit.id,
            amount: remainingUnpaid,
            settledAmount: 0,
            status: 'unpaid',
            notes: `Auto-closed at 02:00 AM cutoff (${dateStr})`
          }
        });
        creditRecordId = cr.id;
      }

      // 4. Update the visit to completed
      const paymentStatus = remainingUnpaid === 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'credit');
      const updatedVisit = await prisma.visit.update({
        where: { id: visit.id },
        data: {
          endTime: visitEndTime,
          status: 'completed',
          itemsTotal,
          tablesTotal,
          visitTotal,
          paidAmount: totalPaid,
          balanceDue: remainingUnpaid,
          paymentStatus
        }
      });

      // 5. Update Customer's Live currentCreditDue & Lifetime totals
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

      broadcast({ type: 'VISIT_AUTO_CLOSED', visitId: visit.id, customerId: visit.customerId, remainingUnpaid });

      closedDetails.push({
        visitId: visit.id,
        customerId: visit.customerId,
        customerName: visit.customer?.name,
        visitTotal,
        totalPaid,
        remainingUnpaid,
        creditRecordId
      });
    } catch (err: any) {
      console.error(`[AUTO-CLOSE] Error auto-closing visit ${visit.id}:`, err);
    }
  }

  console.log(`[AUTO-CLOSE] Completed! Auto-closed ${closedDetails.length} active visit(s).`);
  return { closedCount: closedDetails.length, details: closedDetails };
}
