"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { lookupWord, type WordDetails } from "@/lib/dictionary";

const folderNameSchema = z.string().trim().min(1).max(100);
const wordTextSchema = z.string().trim().min(1).max(100);

export async function createFolder(name: string) {
  const user = await requireUser();
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) throw new Error("Folder name is required");

  await db.insert(folders).values({ userId: user.id, name: parsed.data });
  revalidatePath("/vocabulary");
}

export async function renameFolder(folderId: string, name: string) {
  const user = await requireUser();
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) throw new Error("Folder name is required");

  await db
    .update(folders)
    .set({ name: parsed.data })
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.id)));
  revalidatePath("/vocabulary");
}

export async function deleteFolder(folderId: string) {
  const user = await requireUser();
  await db
    .delete(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.id)));
  revalidatePath("/vocabulary");
}

export async function addWord(
  folderId: string,
  text: string
): Promise<{ error?: string; notFound?: boolean }> {
  const user = await requireUser();
  const parsed = wordTextSchema.safeParse(text);
  if (!parsed.success) return { error: "Word is required" };

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.id)))
    .limit(1);
  if (!folder) return { error: "Folder not found" };

  const lookup = await lookupWord(parsed.data);
  const details: Partial<WordDetails> = lookup.ok ? lookup.details : {};

  await db.insert(words).values({
    userId: user.id,
    folderId,
    text: parsed.data,
    definition: details.definition,
    partOfSpeech: details.partOfSpeech,
    example: details.example,
    phoneticText: details.phoneticText,
  });

  revalidatePath(`/vocabulary/${folderId}`);
  return lookup.ok ? {} : { notFound: true };
}

export async function updateWord(
  wordId: string,
  data: { text?: string; definition?: string; example?: string }
) {
  const user = await requireUser();
  const [word] = await db
    .select()
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) throw new Error("Word not found");

  await db
    .update(words)
    .set(data)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)));
  revalidatePath(`/vocabulary/${word.folderId}`);
}

export async function deleteWord(wordId: string) {
  const user = await requireUser();
  const [word] = await db
    .select()
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) return;

  await db
    .delete(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)));
  revalidatePath(`/vocabulary/${word.folderId}`);
}
