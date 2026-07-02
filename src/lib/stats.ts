/**
 * Consecutive-day streak from a set of "YYYY-MM-DD" day strings (already in
 * the user's timezone). A streak counts if it ends today or yesterday, so it
 * isn't shown as broken before the user has reviewed today.
 */
export function computeStreak(reviewDays: string[], today: string): number {
  const daySet = new Set(reviewDays);
  const cursor = new Date(`${today}T00:00:00Z`);
  const format = (d: Date) => d.toISOString().slice(0, 10);

  if (!daySet.has(format(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (daySet.has(format(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
