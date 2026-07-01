"use server";

import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { words, reviewLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { applySm2, type SrsGrade } from "@/lib/srs";

export interface ReviewWord {
  id: string;
  text: string;
  definition: string | null;
  partOfSpeech: string | null;
  example: string | null;
  phoneticText: string | null;
  phoneticAudioUrl: string | null;
  srsInterval: number;
  srsEase: number;
  srsRepetitions: number;
}

const wordColumns = {
  id: words.id,
  text: words.text,
  definition: words.definition,
  partOfSpeech: words.partOfSpeech,
  example: words.example,
  phoneticText: words.phoneticText,
  phoneticAudioUrl: words.phoneticAudioUrl,
  srsInterval: words.srsInterval,
  srsEase: words.srsEase,
  srsRepetitions: words.srsRepetitions,
};

export async function getDueWords(
  scope: { folderId: string } | { all: true }
): Promise<{ words: ReviewWord[]; aheadOfSchedule: boolean }> {
  const user = await requireUser();
  const now = new Date();
  const scopeClause =
    "folderId" in scope
      ? and(eq(words.userId, user.id), eq(words.folderId, scope.folderId))
      : eq(words.userId, user.id);

  const due = await db
    .select(wordColumns)
    .from(words)
    .where(and(scopeClause, lte(words.nextReviewAt, now)))
    .orderBy(asc(words.nextReviewAt));

  if (due.length > 0) return { words: due, aheadOfSchedule: false };

  const ahead = await db
    .select(wordColumns)
    .from(words)
    .where(scopeClause)
    .orderBy(asc(words.nextReviewAt))
    .limit(20);

  return { words: ahead, aheadOfSchedule: true };
}

export async function submitReview(
  wordId: string,
  grade: SrsGrade
): Promise<{ nextReviewAt: Date }> {
  const user = await requireUser();

  const [word] = await db
    .select()
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) throw new Error("Word not found");

  const update = applySm2(
    {
      interval: word.srsInterval,
      ease: word.srsEase,
      repetitions: word.srsRepetitions,
    },
    grade
  );

  await db.transaction(async (tx) => {
    await tx
      .update(words)
      .set({
        srsInterval: update.interval,
        srsEase: update.ease,
        srsRepetitions: update.repetitions,
        nextReviewAt: update.nextReviewAt,
        rememberedCount:
          grade === "remembered"
            ? sql`${words.rememberedCount} + 1`
            : words.rememberedCount,
        notRememberedCount:
          grade === "not_remembered"
            ? sql`${words.notRememberedCount} + 1`
            : words.notRememberedCount,
      })
      .where(eq(words.id, wordId));

    await tx.insert(reviewLogs).values({ wordId, userId: user.id, result: grade });
  });

  return { nextReviewAt: update.nextReviewAt };
}
