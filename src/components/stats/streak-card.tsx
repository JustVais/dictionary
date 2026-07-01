import { Flame } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StreakCard({ streak }: { streak: number }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <Flame className="size-8 text-orange-500" />
      <div>
        <div className="text-2xl font-semibold">{streak}</div>
        <div className="text-sm text-muted-foreground">
          day streak{streak === 1 ? "" : "s"}
        </div>
      </div>
    </Card>
  );
}
