/**
 * Rebound Lounge - Centralized Table & Station Hourly Pricing Engine
 *
 * Rules:
 * - PS4 Console:
 *     1 Player  -> ₹80 / hr
 *     2 Players -> ₹150 / hr
 *     3 Players -> ₹200 / hr
 *     4 Players -> ₹200 / hr
 * - Mid Snooker: ₹220 / hr (or custom table rate if set)
 * - Pool Tables: ₹160 / hr (or custom table rate if set)
 */

export const getPS4HourlyRate = (playerCount: number = 1): number => {
  const count = Math.max(1, Math.min(4, Math.floor(playerCount) || 1));
  if (count === 1) return 80;
  if (count === 2) return 150;
  return 200; // 3 or 4 players
};

export const getPlayHourlyRate = (play: {
  gameType?: string | null;
  playerCount?: number | null;
  table?: { ratePerHour?: number | null; gameType?: string | null } | null;
}): number => {
  const gType = play.gameType || play.table?.gameType || 'Pool';
  if (gType === 'PS4') {
    return getPS4HourlyRate(play.playerCount || 1);
  }
  if (play.table?.ratePerHour && play.table.ratePerHour > 0) {
    return play.table.ratePerHour;
  }
  if (gType === 'MidSnooker') return 220;
  return 160;
};

