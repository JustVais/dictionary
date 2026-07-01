import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers } from "lucide-react";

export default async function CardsPage() {
  const user = await requireUser();

  const rows = await db
    .select({
      id: folders.id,
      name: folders.name,
      wordCount: count(words.id),
    })
    .from(folders)
    .leftJoin(words, eq(words.folderId, folders.id))
    .where(eq(folders.userId, user.id))
    .groupBy(folders.id)
    .orderBy(folders.createdAt);

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Cards</h1>

      <Link href="/cards/session?mode=all">
        <Button className="w-full" size="lg">
          <Layers className="size-4" />
          Study All
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
              <Card className="p-4">
                <div className="font-medium">{folder.name}</div>
                <div className="text-sm text-muted-foreground">
                  {folder.wordCount} word{folder.wordCount === 1 ? "" : "s"}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
