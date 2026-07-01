import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewLogs, words, folders } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { computeStreak } from "@/lib/stats";

export interface DailyTrendPoint {
  day: string;
  remembered: number;
  total: number;
}

export async function getDailyTrend(): Promise<DailyTrendPoint[]> {
  const user = await requireUser();
  const rows = await db.execute<{ day: string; remembered: number; total: number }>(sql`
    select to_char(date_trunc('day', reviewed_at), 'YYYY-MM-DD') as day,
           count(*) filter (where result = 'remembered')::int as remembered,
           count(*)::int as total
    from ${reviewLogs}
    where ${reviewLogs.userId} = ${user.id} and reviewed_at > now() - interval '30 days'
    group by day
    order by day asc
  `);
  return rows.rows.map((r) => ({
    day: r.day,
    remembered: Number(r.remembered),
    total: Number(r.total),
  }));
}

export async function getStreak(): Promise<number> {
  const user = await requireUser();
  const rows = await db
    .selectDistinct({
      day: sql<string>`date_trunc('day', ${reviewLogs.reviewedAt})`,
    })
    .from(reviewLogs)
    .where(eq(reviewLogs.userId, user.id));

  return computeStreak(rows.map((r) => new Date(r.day)));
}

export interface FolderBreakdownRow {
  folderId: string;
  folderName: string;
  remembered: number;
  notRemembered: number;
  accuracy: number;
}

export async function getFolderBreakdown(): Promise<FolderBreakdownRow[]> {
  const user = await requireUser();
  const rows = await db
    .select({
      folderId: words.folderId,
      folderName: folders.name,
      remembered: words.rememberedCount,
      notRemembered: words.notRememberedCount,
    })
    .from(words)
    .innerJoin(folders, eq(folders.id, words.folderId))
    .where(eq(words.userId, user.id));

  const byFolder = new Map<
    string,
    { folderName: string; remembered: number; notRemembered: number }
  >();

  for (const row of rows) {
    const existing = byFolder.get(row.folderId) ?? {
      folderName: row.folderName,
      remembered: 0,
      notRemembered: 0,
    };
    existing.remembered += row.remembered;
    existing.notRemembered += row.notRemembered;
    byFolder.set(row.folderId, existing);
  }

  return Array.from(byFolder.entries())
    .map(([folderId, v]) => ({
      folderId,
      folderName: v.folderName,
      remembered: v.remembered,
      notRemembered: v.notRemembered,
      accuracy:
        v.remembered + v.notRemembered > 0
          ? Math.round((v.remembered / (v.remembered + v.notRemembered)) * 100)
          : 0,
    }))
    .filter((f) => f.remembered + f.notRemembered >= 3)
    .sort((a, b) => b.accuracy - a.accuracy);
}
