export function computeStreak(reviewDays: Date[], today: Date = new Date()): number {
  const daySet = new Set(reviewDays.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date(today);
  cursor.setUTCHours(0, 0, 0, 0);

  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}
