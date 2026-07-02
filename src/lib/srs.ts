import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
  type State,
} from "ts-fsrs";

export type SrsGrade = "again" | "hard" | "good" | "easy";

export const SRS_GRADES: SrsGrade[] = ["again", "hard", "good", "easy"];

const GRADE_TO_RATING: Record<SrsGrade, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Mirrors the FSRS card fields we persist on `words`. `reps`/`lapses` are
// approximated from the review counters — FSRS only uses them for fuzz
// seeding, not scheduling.
export interface SrsCardState {
  stability: number;
  difficulty: number;
  state: number; // ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning
  learningSteps: number;
  due: Date;
  lastReviewedAt: Date | null;
  reps: number;
  lapses: number;
}

export interface SrsUpdateResult {
  stability: number;
  difficulty: number;
  state: number;
  learningSteps: number;
  nextReviewAt: Date;
}

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

function toCard(state: SrsCardState, now: Date): Card {
  if (state.state === 0 && state.reps === 0) return createEmptyCard(now);

  const lastReview = state.lastReviewedAt ?? undefined;
  const scheduledDays = lastReview
    ? Math.max(
        0,
        Math.round((state.due.getTime() - lastReview.getTime()) / DAY_MS)
      )
    : 0;
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: lastReview
      ? Math.max(0, (now.getTime() - lastReview.getTime()) / DAY_MS)
      : 0,
    scheduled_days: scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    last_review: lastReview,
  };
}

export function applyFsrs(
  state: SrsCardState,
  grade: SrsGrade,
  now: Date = new Date()
): SrsUpdateResult {
  const { card } = scheduler.next(toCard(state, now), now, GRADE_TO_RATING[grade]);
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    learningSteps: card.learning_steps,
    nextReviewAt: card.due,
  };
}

/** Next-due preview for every grade — powers the interval hints on the answer buttons. */
export function previewGrades(
  state: SrsCardState,
  now: Date = new Date()
): Record<SrsGrade, Date> {
  const preview = scheduler.repeat(toCard(state, now), now);
  return {
    again: preview[Rating.Again].card.due,
    hard: preview[Rating.Hard].card.due,
    good: preview[Rating.Good].card.due,
    easy: preview[Rating.Easy].card.due,
  };
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;

/** Compact "10m" / "3h" / "6d" / "2mo" label for a scheduled interval. */
export function formatInterval(due: Date, now: Date = new Date()): string {
  const ms = Math.max(0, due.getTime() - now.getTime());
  if (ms < HOUR_MS) return `${Math.max(1, Math.round(ms / MINUTE_MS))}m`;
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`;
  if (ms < MONTH_MS * 2) return `${Math.round(ms / DAY_MS)}d`;
  return `${Math.round(ms / MONTH_MS)}mo`;
}

/** Grades that count as a successful recall for the counters/stats. */
export function isRemembered(grade: SrsGrade): boolean {
  return grade !== "again";
}
