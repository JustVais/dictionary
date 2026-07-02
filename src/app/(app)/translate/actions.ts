"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { folders, words } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { lookupWord, type WordDetails } from "@/lib/dictionary";

export async function lookupWordAction(
  word: string
): Promise<{ ok: true; details: WordDetails } | { ok: false; reason: string }> {
  await requireUser();
  const trimmed = word.trim();
  if (!trimmed) return { ok: false, reason: "Enter a word to look up" };

  const result = await lookupWord(trimmed);
  if (!result.ok) {
    return {
      ok: false,
      reason:
        result.reason === "not_found"
          ? "No definition found for that word"
          : "Something went wrong. Please try again.",
    };
  }

  return { ok: true, details: result.details };
}

export async function addLookedUpWordToFolder(
  folderId: string,
  details: WordDetails
) {
  const user = await requireUser();

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.id)))
    .limit(1);
  if (!folder) throw new Error("Folder not found");

  await db.insert(words).values({
    userId: user.id,
    folderId,
    text: details.word,
    definition: details.definition,
    partOfSpeech: details.partOfSpeech,
    example: details.example,
    phoneticText: details.phoneticText,
  });

  revalidatePath(`/vocabulary/${folderId}`);
}
