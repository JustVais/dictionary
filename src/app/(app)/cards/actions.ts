"use server";

import { and, asc, count, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { words, reviewLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { applyFsrs, isRemembered, type SrsGrade } from "@/lib/srs";
import { getWordForms } from "@/lib/word-forms";
import { translateEnToRu } from "@/lib/translate";

/**
 * Best-effort en→ru backfill for cards missing a Russian translation, so the
 * review card's Russian stage (and its offline cache) has data. Runs in
 * parallel and persists results; failures leave the field null and never block.
 */
async function backfillTranslations<
  T extends { id: string; text: string; translation: string | null }
>(rows: T[]): Promise<T[]> {
  const missing = rows.filter((r) => !r.translation);
  await Promise.all(
    missing.map(async (row) => {
      const res = await translateEnToRu(row.text);
      if (!res.ok) return;
      row.translation = res.translated;
      await db
        .update(words)
        .set({ translation: res.translated })
        .where(eq(words.id, row.id));
    })
  );
  return rows;
}

export interface ReviewWord {
  id: string;
  text: string;
  translation: string | null;
  definition: string | null;
  partOfSpeech: string | null;
  example: string | null;
  phoneticText: string | null;
  forms: string[];
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
  translation: words.translation,
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

// Due sessions are capped so a backlog doesn't become one endless session;
// the summary offers to continue with the rest.
const SESSION_LIMIT = 20;

export async function getDueWords(
  scope: { folderId: string } | { all: true },
  options: { ahead?: boolean } = {}
): Promise<{ words: ReviewWord[]; dueRemaining: number; aheadOfSchedule: boolean }> {
  const user = await requireUser();
  const now = new Date();
  const scopeClause =
    "folderId" in scope
      ? and(eq(words.userId, user.id), eq(words.folderId, scope.folderId))
      : eq(words.userId, user.id);
  const dueClause = and(scopeClause, lte(words.nextReviewAt, now));

  const withForms = <T extends { text: string; partOfSpeech: string | null }>(
    rows: T[]
  ) => rows.map((row) => ({ ...row, forms: getWordForms(row.text, row.partOfSpeech) }));

  const due = await db
    .select(wordColumns)
    .from(words)
    .where(dueClause)
    .orderBy(asc(words.nextReviewAt))
    .limit(SESSION_LIMIT);

  if (due.length > 0) {
    const [{ value: totalDue }] = await db
      .select({ value: count() })
      .from(words)
      .where(dueClause);
    return {
      words: withForms(await backfillTranslations(due)),
      dueRemaining: totalDue - due.length,
      aheadOfSchedule: false,
    };
  }

  if (!options.ahead) return { words: [], dueRemaining: 0, aheadOfSchedule: false };

  const ahead = await db
    .select(wordColumns)
    .from(words)
    .where(scopeClause)
    .orderBy(asc(words.nextReviewAt))
    .limit(SESSION_LIMIT);

  return {
    words: withForms(await backfillTranslations(ahead)),
    dueRemaining: 0,
    aheadOfSchedule: true,
  };
}

/**
 * Online fallback for the card's Russian stage when a word still has no stored
 * translation (e.g. reached before getDueWords backfilled it). Returns the
 * stored translation or lazily fetches, persists, and returns it.
 */
export async function translateWordForReview(
  wordId: string
): Promise<string | null> {
  const user = await requireUser();
  const [word] = await db
    .select({ id: words.id, text: words.text, translation: words.translation })
    .from(words)
    .where(and(eq(words.id, wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) return null;
  if (word.translation) return word.translation;

  const res = await translateEnToRu(word.text);
  if (!res.ok) return null;
  await db
    .update(words)
    .set({ translation: res.translated })
    .where(eq(words.id, wordId));
  return res.translated;
}

/** A review outcome computed offline, flushed from the client outbox. */
export interface ReviewOutcome {
  reviewId: string;
  wordId: string;
  grade: SrsGrade;
  reviewedAt: string; // ISO
  resulting: {
    fsrsStability: number;
    fsrsDifficulty: number;
    fsrsState: number;
    fsrsLearningSteps: number;
    nextReviewAt: string; // ISO
    rememberedCount: number;
    notRememberedCount: number;
  };
}

/**
 * Apply a client-computed review outcome. Absolute state + a unique clientId
 * (onConflictDoNothing) make this idempotent, so re-flushing the outbox — or
 * flushing outcomes out of order — is safe. Flushing in reviewedAt order lets
 * the last outcome win for a card reviewed multiple times offline.
 */
export async function syncReview(outcome: ReviewOutcome): Promise<void> {
  const user = await requireUser();
  const [word] = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.id, outcome.wordId), eq(words.userId, user.id)))
    .limit(1);
  if (!word) return; // word was deleted; drop the outcome silently

  const { resulting } = outcome;
  const reviewedAt = new Date(outcome.reviewedAt);

  await db.transaction(async (tx) => {
    await tx
      .update(words)
      .set({
        fsrsStability: resulting.fsrsStability,
        fsrsDifficulty: resulting.fsrsDifficulty,
        fsrsState: resulting.fsrsState,
        fsrsLearningSteps: resulting.fsrsLearningSteps,
        nextReviewAt: new Date(resulting.nextReviewAt),
        lastReviewedAt: reviewedAt,
        rememberedCount: resulting.rememberedCount,
        notRememberedCount: resulting.notRememberedCount,
      })
      .where(eq(words.id, outcome.wordId));

    await tx
      .insert(reviewLogs)
      .values({
        wordId: outcome.wordId,
        userId: user.id,
        result: isRemembered(outcome.grade) ? "remembered" : "not_remembered",
        grade: outcome.grade,
        reviewedAt,
        clientId: outcome.reviewId,
      })
      .onConflictDoNothing({ target: reviewLogs.clientId });
  });
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
