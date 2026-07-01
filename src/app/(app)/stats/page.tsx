import { getDailyTrend, getStreak, getFolderBreakdown } from "./queries";
import { StreakCard } from "@/components/stats/streak-card";
import { DailyChart } from "@/components/stats/daily-chart";
import { FolderBreakdown } from "@/components/stats/folder-breakdown";

export default async function StatsPage() {
  const [streak, dailyTrend, folderBreakdown] = await Promise.all([
    getStreak(),
    getDailyTrend(),
    getFolderBreakdown(),
  ]);

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Stats</h1>
      <StreakCard streak={streak} />
      <DailyChart points={dailyTrend} />
      <FolderBreakdown rows={folderBreakdown} />
    </div>
  );
}
