import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { getWordForms } from "@/lib/word-forms";
import { WordList } from "@/components/vocabulary/word-list";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const user = await requireUser();

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.id)))
    .limit(1);
  if (!folder) notFound();

  const wordRows = await db
    .select({
      id: words.id,
      text: words.text,
      definition: words.definition,
      example: words.example,
      partOfSpeech: words.partOfSpeech,
      rememberedCount: words.rememberedCount,
      notRememberedCount: words.notRememberedCount,
    })
    .from(words)
    .where(eq(words.folderId, folderId))
    .orderBy(words.createdAt);

  const wordsWithForms = wordRows.map((word) => ({
    ...word,
    forms: getWordForms(word.text, word.partOfSpeech),
  }));

  return (
    <WordList
      folderId={folder.id}
      folderName={folder.name}
      words={wordsWithForms}
    />
  );
}
