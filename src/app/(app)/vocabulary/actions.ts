"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { lookupWord, type WordDetails } from "@/lib/dictionary";

const folderNameSchema = z.string().trim().min(1).max(100);
const wordTextSchema = z.string().trim().min(1).max(100);
const longTextSchema = z.string().trim().max(2000);

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

/** Fetch definition candidates for the add-word preview step. */
export async function lookupForAdd(
  text: string
): Promise<
  | { ok: true; details: WordDetails; found: boolean }
  | { ok: false; error: string }
> {
  await requireUser();
  const parsed = wordTextSchema.safeParse(text);
  if (!parsed.success) return { ok: false, error: "Word is required" };

  const lookup = await lookupWord(parsed.data);
  if (!lookup.ok) {
    return { ok: true, details: { word: parsed.data }, found: false };
  }
  return { ok: true, details: lookup.details, found: true };
}

export type AddWordResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

export async function addWordWithDetails(
  folderId: string,
  details: WordDetails
): Promise<AddWordResult> {
  const user = await requireUser();
  const parsedText = wordTextSchema.safeParse(details.word);
  if (!parsedText.success) return { ok: false, error: "Word is required" };
  const text = parsedText.data;
  const definition = longTextSchema.safeParse(details.definition ?? "");
  const example = longTextSchema.safeParse(details.example ?? "");
  const translation = longTextSchema.safeParse(details.translation ?? "");
  if (!definition.success || !example.success || !translation.success) {
    return { ok: false, error: "Definition, example, or translation is too long" };
  }

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.id)))
    .limit(1);
  if (!folder) return { ok: false, error: "Folder not found" };

  const duplicates = await db
    .select({ folderId: words.folderId, folderName: folders.name })
    .from(words)
    .innerJoin(folders, eq(folders.id, words.folderId))
    .where(
      and(
        eq(words.userId, user.id),
        sql`lower(${words.text}) = ${text.toLowerCase()}`
      )
    );
  if (duplicates.some((d) => d.folderId === folderId)) {
    return { ok: false, error: `"${text}" is already in this folder` };
  }

  await db.insert(words).values({
    userId: user.id,
    folderId,
    text,
    translation: translation.data || null,
    definition: definition.data || null,
    partOfSpeech: details.partOfSpeech,
    example: example.data || null,
    phoneticText: details.phoneticText,
  });

  revalidatePath(`/vocabulary/${folderId}`);
  const elsewhere = duplicates[0];
  return {
    ok: true,
    warning: elsewhere
      ? `"${text}" is also in "${elsewhere.folderName}".`
      : undefined,
  };
}

const wordUpdateSchema = z.object({
  text: wordTextSchema,
  definition: longTextSchema,
  example: longTextSchema,
});

export async function updateWord(
  wordId: string,
  data: { text: string; definition: string; example: string }
) {
  const user = await requireUser();
  const parsed = wordUpdateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid word data");

  const [word] = await db
    .select()
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) throw new Error("Word not found");

  await db
    .update(words)
    .set({
      text: parsed.data.text,
      definition: parsed.data.definition || null,
      example: parsed.data.example || null,
    })
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
