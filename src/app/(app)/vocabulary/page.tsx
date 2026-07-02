import Link from "next/link";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { FolderList } from "@/components/vocabulary/folder-list";
import { WordSearch } from "@/components/vocabulary/word-search";
import { Card } from "@/components/ui/card";

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const user = await requireUser();

  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const results = await db
      .select({
        id: words.id,
        text: words.text,
        definition: words.definition,
        folderId: words.folderId,
        folderName: folders.name,
      })
      .from(words)
      .innerJoin(folders, eq(folders.id, words.folderId))
      .where(
        and(
          eq(words.userId, user.id),
          or(ilike(words.text, pattern), ilike(words.definition, pattern))
        )
      )
      .orderBy(words.text)
      .limit(50);

    return (
      <div className="grid gap-4">
        <h1 className="text-lg font-semibold">Vocabulary</h1>
        <WordSearch initialQuery={query} />
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No words match “{query}”.
          </p>
        ) : (
          <div className="grid gap-2">
            {results.map((word) => (
              <Link key={word.id} href={`/vocabulary/${word.folderId}`}>
                <Card className="gap-1 p-4">
                  <div className="font-medium">{word.text}</div>
                  {word.definition && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {word.definition}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {word.folderName}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

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
      <WordSearch initialQuery="" />
      <FolderList folders={rows} />
    </div>
  );
}
