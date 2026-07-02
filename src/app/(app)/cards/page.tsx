import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function CardsPage() {
  const user = await requireUser();

  const rows = await db
    .select({
      id: folders.id,
      name: folders.name,
      wordCount: count(words.id),
      dueCount:
        sql<number>`count(*) filter (where ${words.nextReviewAt} <= now())`.mapWith(
          Number
        ),
    })
    .from(folders)
    .leftJoin(words, eq(words.folderId, folders.id))
    .where(eq(folders.userId, user.id))
    .groupBy(folders.id)
    .orderBy(folders.createdAt);

  const totalDue = rows.reduce((sum, folder) => sum + folder.dueCount, 0);

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold max-md:hidden">Cards</h1>

      <Link href="/cards/session?mode=all">
        <Button className="w-full" size="lg">
          <Layers className="size-4" />
          Study All
          {totalDue > 0 && ` — ${totalDue} due`}
        </Button>
      </Link>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No folders yet. Add words in Vocabulary first.
        </p>
      ) : (
        <div className="grid gap-2">
          {rows.map((folder) => (
            <Link key={folder.id} href={`/cards/session?folderId=${folder.id}`}>
              <Card className="flex-row items-center justify-between p-4">
                <div>
                  <div className="font-medium">{folder.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {folder.wordCount} word{folder.wordCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    folder.dueCount > 0
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {folder.dueCount > 0 ? `${folder.dueCount} due` : "Done"}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
