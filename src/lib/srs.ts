export type SrsGrade = "remembered" | "not_remembered";

export interface SrsState {
  interval: number; // days; 0 = never successfully scheduled
  ease: number; // ease factor, default 2.5, floor 1.3
  repetitions: number; // consecutive successful reviews; resets to 0 on a lapse
}

export interface SrsUpdateResult extends SrsState {
  nextReviewAt: Date;
}

const MIN_EASE = 1.3;
const EASE_PENALTY_ON_LAPSE = 0.2;
const DAY_MS = 24 * 60 * 60 * 1000;

export function applySm2(
  state: SrsState,
  grade: SrsGrade,
  now: Date = new Date()
): SrsUpdateResult {
  if (grade === "not_remembered") {
    const ease = Math.max(MIN_EASE, state.ease - EASE_PENALTY_ON_LAPSE);
    return { interval: 0, ease, repetitions: 0, nextReviewAt: now };
  }

  const repetitions = state.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = 1;
  else if (repetitions === 2) interval = 6;
  else interval = Math.round(state.interval * state.ease);

  const nextReviewAt = new Date(now.getTime() + interval * DAY_MS);
  return { interval, ease: state.ease, repetitions, nextReviewAt };
}
