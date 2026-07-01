import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { FolderList } from "@/components/vocabulary/folder-list";

export default async function VocabularyPage() {
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

  return <FolderList folders={rows} />;
}
