import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SessionSummary({
  firstTryRemembered,
  totalCards,
}: {
  firstTryRemembered: number;
  totalCards: number;
}) {
  return (
    <Card className="grid gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Session complete</h2>
      <p className="text-muted-foreground">
        {firstTryRemembered}/{totalCards} remembered on first try
      </p>
      <Link href="/cards">
        <Button className="w-full">Back to Cards</Button>
      </Link>
    </Card>
  );
}
