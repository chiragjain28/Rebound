import { runNightlyAutoClose } from '../services/autoClose.service';

/**
 * Calculates the next 02:00 AM Date object in local time.
 */
function getNext2AM(): Date {
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);

  // If 2:00 AM has already passed today, schedule for 2:00 AM tomorrow
  if (now.getTime() >= next2AM.getTime()) {
    next2AM.setDate(next2AM.getDate() + 1);
  }

  return next2AM;
}

/**
 * Calculates the most recent 02:00 AM Date object in local time.
 */
function getPrevious2AM(): Date {
  const now = new Date();
  const prev2AM = new Date(now);
  prev2AM.setHours(2, 0, 0, 0);

  // If 2:00 AM has not yet occurred today, the previous 2:00 AM was yesterday
  if (now.getTime() < prev2AM.getTime()) {
    prev2AM.setDate(prev2AM.getDate() - 1);
  }

  return prev2AM;
}

/**
 * Initializes the Nightly 02:00 AM Auto-close scheduler and startup catch-up.
 */
export function initNightlyAutoCloseJob() {
  console.log('[JOB] Initializing Nightly 02:00 AM Auto-Close worker...');

  // 1. Startup Catch-Up Check:
  // If the server was offline at 02:00 AM, or there are stale active visits started before the latest 2:00 AM cutoff, close them now!
  const last2AM = getPrevious2AM();
  console.log(`[JOB] Running startup catch-up for active visits started on or before ${last2AM.toLocaleString('en-IN')}`);

  runNightlyAutoClose(last2AM)
    .then((res) => {
      if (res.closedCount > 0) {
        console.log(`[JOB] Startup catch-up auto-closed ${res.closedCount} leftover active visit(s).`);
      } else {
        console.log('[JOB] Startup catch-up: All visits clean, no stale active visits found.');
      }
    })
    .catch((err) => {
      console.warn('[JOB] Warning: Startup auto-close catch-up could not query database:', err.message || err);
    });

  // 2. Schedule recurring 02:00 AM execution
  function scheduleNextRun() {
    const nextRun = getNext2AM();
    const delay = nextRun.getTime() - Date.now();
    console.log(`[JOB] Next 02:00 AM Auto-Close scheduled for ${nextRun.toLocaleString('en-IN')} (in ${(delay / 3600000).toFixed(2)} hours)`);

    setTimeout(async () => {
      try {
        console.log(`[JOB] 02:00 AM Strike! Executing nightly auto-close...`);
        await runNightlyAutoClose(nextRun);
      } catch (err) {
        console.error('[JOB] Error running scheduled 02:00 AM auto-close:', err);
      } finally {
        // Schedule next day's 02:00 AM
        scheduleNextRun();
      }
    }, delay);
  }

  scheduleNextRun();

  // 3. Periodic Watchdog (Every 15 minutes):
  // If the host machine/laptop went into standby/sleep overnight, this ensures stale visits
  // started before the previous 02:00 AM cutoff are auto-closed immediately upon wake-up.
  setInterval(async () => {
    try {
      const prev2AM = getPrevious2AM();
      await runNightlyAutoClose(prev2AM);
    } catch {
      // Quiet background check
    }
  }, 15 * 60 * 1000);
}
