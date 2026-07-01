import { Card } from "@/components/ui/card";
import type { DailyTrendPoint } from "@/app/(app)/stats/queries";

export function DailyChart({ points }: { points: DailyTrendPoint[] }) {
  if (points.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          No reviews yet in the last 30 days.
        </p>
      </Card>
    );
  }

  const maxTotal = Math.max(...points.map((p) => p.total), 1);

  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-medium">Last 30 days</h2>
      <div className="flex h-32 items-end gap-1">
        {points.map((p) => {
          const totalHeightPct = (p.total / maxTotal) * 100;
          const rememberedShareOfBar = p.total > 0 ? (p.remembered / p.total) * 100 : 0;
          return (
            <div
              key={p.day}
              title={`${p.day}: ${p.remembered}/${p.total} remembered`}
              className="flex flex-1 flex-col justify-end rounded-sm bg-muted"
              style={{ height: `${totalHeightPct}%` }}
            >
              <div
                className="rounded-sm bg-primary"
                style={{ height: `${rememberedShareOfBar}%` }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
