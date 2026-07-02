import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SessionSummary({
  firstTryRemembered,
  totalCards,
  dueRemaining = 0,
  continueHref,
}: {
  firstTryRemembered: number;
  totalCards: number;
  dueRemaining?: number;
  continueHref?: string;
}) {
  return (
    <Card className="grid gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Session complete</h2>
      <p className="text-muted-foreground">
        {firstTryRemembered}/{totalCards} remembered on first try
      </p>
      {dueRemaining > 0 && continueHref && (
        <Link href={continueHref}>
          <Button className="w-full">
            Review {dueRemaining} more due word{dueRemaining === 1 ? "" : "s"}
          </Button>
        </Link>
      )}
      <Link href="/cards">
        <Button variant="outline" className="w-full">
          Back to Cards
        </Button>
      </Link>
    </Card>
  );
}
