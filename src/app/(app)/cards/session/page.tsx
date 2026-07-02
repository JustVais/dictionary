import Link from "next/link";
import { notFound } from "next/navigation";
import { getDueWords } from "../actions";
import { ReviewSession } from "@/components/cards/review-session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function ReviewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; mode?: string; ahead?: string }>;
}) {
  const { folderId, mode, ahead } = await searchParams;

  if (!folderId && mode !== "all") notFound();

  const scope = mode === "all" ? ({ all: true } as const) : { folderId: folderId! };
  const { words, dueRemaining, aheadOfSchedule } = await getDueWords(scope, {
    ahead: ahead === "1",
  });

  const baseQuery = mode === "all" ? "mode=all" : `folderId=${folderId}`;

  if (words.length === 0) {
    return (
      <Card className="grid gap-4 p-6 text-center">
        <h2 className="text-lg font-semibold">
          {aheadOfSchedule ? "No words to review" : "All caught up!"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {aheadOfSchedule
            ? "Add words in Vocabulary first."
            : "Nothing is due right now. You can review ahead of schedule anyway."}
        </p>
        {!aheadOfSchedule && (
          <Link href={`/cards/session?${baseQuery}&ahead=1`}>
            <Button className="w-full">Review ahead</Button>
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

  return (
    <ReviewSession
      initialWords={words}
      aheadOfSchedule={aheadOfSchedule}
      dueRemaining={dueRemaining}
      continueHref={`/cards/session?${baseQuery}`}
    />
  );
}
