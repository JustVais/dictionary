"use server";

import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { words, reviewLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { applyFsrs, isRemembered, type SrsGrade } from "@/lib/srs";

export interface ReviewWord {
  id: string;
  text: string;
  definition: string | null;
  partOfSpeech: string | null;
  example: string | null;
  phoneticText: string | null;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: number;
  fsrsLearningSteps: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  rememberedCount: number;
  notRememberedCount: number;
}

/** Snapshot of a word's scheduling state before a review, for undo. */
export interface SrsSnapshot {
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: number;
  fsrsLearningSteps: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
}

const wordColumns = {
  id: words.id,
  text: words.text,
  definition: words.definition,
  partOfSpeech: words.partOfSpeech,
  example: words.example,
  phoneticText: words.phoneticText,
  fsrsStability: words.fsrsStability,
  fsrsDifficulty: words.fsrsDifficulty,
  fsrsState: words.fsrsState,
  fsrsLearningSteps: words.fsrsLearningSteps,
  nextReviewAt: words.nextReviewAt,
  lastReviewedAt: words.lastReviewedAt,
  rememberedCount: words.rememberedCount,
  notRememberedCount: words.notRememberedCount,
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
): Promise<{ nextReviewAt: Date; previous: SrsSnapshot }> {
  const user = await requireUser();
  const now = new Date();

  const [word] = await db
    .select()
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) throw new Error("Word not found");

  const previous: SrsSnapshot = {
    fsrsStability: word.fsrsStability,
    fsrsDifficulty: word.fsrsDifficulty,
    fsrsState: word.fsrsState,
    fsrsLearningSteps: word.fsrsLearningSteps,
    nextReviewAt: word.nextReviewAt,
    lastReviewedAt: word.lastReviewedAt,
  };

  const update = applyFsrs(
    {
      stability: word.fsrsStability,
      difficulty: word.fsrsDifficulty,
      state: word.fsrsState,
      learningSteps: word.fsrsLearningSteps,
      due: word.nextReviewAt,
      lastReviewedAt: word.lastReviewedAt,
      reps: word.rememberedCount + word.notRememberedCount,
      lapses: word.notRememberedCount,
    },
    grade,
    now
  );

  const remembered = isRemembered(grade);

  await db.transaction(async (tx) => {
    await tx
      .update(words)
      .set({
        fsrsStability: update.stability,
        fsrsDifficulty: update.difficulty,
        fsrsState: update.state,
        fsrsLearningSteps: update.learningSteps,
        nextReviewAt: update.nextReviewAt,
        lastReviewedAt: now,
        rememberedCount: remembered
          ? sql`${words.rememberedCount} + 1`
          : words.rememberedCount,
        notRememberedCount: remembered
          ? words.notRememberedCount
          : sql`${words.notRememberedCount} + 1`,
      })
      .where(eq(words.id, wordId));

    await tx.insert(reviewLogs).values({
      wordId,
      userId: user.id,
      result: remembered ? "remembered" : "not_remembered",
      grade,
    });
  });

  return { nextReviewAt: update.nextReviewAt, previous };
}

export async function undoReview(
  wordId: string,
  grade: SrsGrade,
  previous: SrsSnapshot
): Promise<void> {
  const user = await requireUser();

  const [word] = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) throw new Error("Word not found");

  const remembered = isRemembered(grade);

  await db.transaction(async (tx) => {
    await tx
      .update(words)
      .set({
        fsrsStability: previous.fsrsStability,
        fsrsDifficulty: previous.fsrsDifficulty,
        fsrsState: previous.fsrsState,
        fsrsLearningSteps: previous.fsrsLearningSteps,
        nextReviewAt: previous.nextReviewAt,
        lastReviewedAt: previous.lastReviewedAt,
        rememberedCount: remembered
          ? sql`greatest(${words.rememberedCount} - 1, 0)`
          : words.rememberedCount,
        notRememberedCount: remembered
          ? words.notRememberedCount
          : sql`greatest(${words.notRememberedCount} - 1, 0)`,
      })
      .where(eq(words.id, wordId));

    const [latest] = await tx
      .select({ id: reviewLogs.id })
      .from(reviewLogs)
      .where(and(eq(reviewLogs.wordId, wordId), eq(reviewLogs.userId, user.id)))
      .orderBy(desc(reviewLogs.reviewedAt))
      .limit(1);
    if (latest) await tx.delete(reviewLogs).where(eq(reviewLogs.id, latest.id));
  });
}
