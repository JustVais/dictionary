"use client";

import { useEffect, useMemo, useReducer, useState, useTransition } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "./review-card";
import { SessionSummary } from "./session-summary";
import {
  submitReview,
  undoReview,
  type ReviewWord,
  type SrsSnapshot,
} from "@/app/(app)/cards/actions";
import {
  applyFsrs,
  formatInterval,
  isRemembered,
  previewGrades,
  type SrsCardState,
  type SrsGrade,
} from "@/lib/srs";

// Cards scheduled less than this far out (intra-day learning steps) come
// back later in the same session instead of waiting for their due time.
const REQUEUE_WINDOW_MS = 60 * 60 * 1000;

function toCardState(word: ReviewWord): SrsCardState {
  return {
    stability: word.fsrsStability,
    difficulty: word.fsrsDifficulty,
    state: word.fsrsState,
    learningSteps: word.fsrsLearningSteps,
    due: new Date(word.nextReviewAt),
    lastReviewedAt: word.lastReviewedAt ? new Date(word.lastReviewedAt) : null,
    reps: word.rememberedCount + word.notRememberedCount,
    lapses: word.notRememberedCount,
  };
}

interface LastAnswer {
  word: ReviewWord; // the card as it was before this answer
  grade: SrsGrade;
  wasFirstAnswer: boolean;
  requeued: boolean;
  // Server's pre-review snapshot; null until submitReview confirms.
  previous: SrsSnapshot | null;
}

interface SessionState {
  queue: ReviewWord[];
  answeredIds: Set<string>;
  correctFirstTry: number;
  totalCards: number;
  lastAnswer: LastAnswer | null;
}

type Action =
  | { type: "ANSWER"; grade: SrsGrade }
  | { type: "CONFIRM"; wordId: string; previous: SrsSnapshot }
  | { type: "UNDO" };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "ANSWER": {
      const [current, ...rest] = state.queue;
      if (!current) return state;

      const now = new Date();
      const update = applyFsrs(toCardState(current), action.grade, now);
      const remembered = isRemembered(action.grade);
      const requeued =
        update.nextReviewAt.getTime() - now.getTime() < REQUEUE_WINDOW_MS;

      let queue = rest;
      if (requeued) {
        const updated: ReviewWord = {
          ...current,
          fsrsStability: update.stability,
          fsrsDifficulty: update.difficulty,
          fsrsState: update.state,
          fsrsLearningSteps: update.learningSteps,
          nextReviewAt: update.nextReviewAt,
          lastReviewedAt: now,
          rememberedCount: current.rememberedCount + (remembered ? 1 : 0),
          notRememberedCount: current.notRememberedCount + (remembered ? 0 : 1),
        };
        const insertAt = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
        queue = [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
      }

      const wasFirstAnswer = !state.answeredIds.has(current.id);
      const answeredIds = new Set(state.answeredIds);
      answeredIds.add(current.id);

      return {
        ...state,
        queue,
        answeredIds,
        correctFirstTry:
          state.correctFirstTry + (wasFirstAnswer && remembered ? 1 : 0),
        lastAnswer: {
          word: current,
          grade: action.grade,
          wasFirstAnswer,
          requeued,
          previous: null,
        },
      };
    }

    case "CONFIRM": {
      const la = state.lastAnswer;
      if (!la || la.word.id !== action.wordId || la.previous) return state;
      return { ...state, lastAnswer: { ...la, previous: action.previous } };
    }

    case "UNDO": {
      const la = state.lastAnswer;
      if (!la) return state;

      const queue = la.requeued
        ? state.queue.filter((w) => w.id !== la.word.id)
        : state.queue;
      const answeredIds = new Set(state.answeredIds);
      if (la.wasFirstAnswer) answeredIds.delete(la.word.id);

      return {
        ...state,
        queue: [la.word, ...queue],
        answeredIds,
        correctFirstTry:
          state.correctFirstTry -
          (la.wasFirstAnswer && isRemembered(la.grade) ? 1 : 0),
        lastAnswer: null,
      };
    }
  }
}

const GRADE_KEYS: Record<string, SrsGrade> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
  ArrowLeft: "again",
  ArrowRight: "good",
};

const GRADE_LABELS: Record<SrsGrade, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const GRADE_VARIANTS: Record<
  SrsGrade,
  "destructive" | "outline" | "default" | "secondary"
> = {
  again: "destructive",
  hard: "outline",
  good: "default",
  easy: "secondary",
};

export function ReviewSession({
  initialWords,
  aheadOfSchedule,
}: {
  initialWords: ReviewWord[];
  aheadOfSchedule: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, {
    queue: initialWords,
    answeredIds: new Set<string>(),
    correctFirstTry: 0,
    totalCards: initialWords.length,
    lastAnswer: null,
  });
  const [flipped, setFlipped] = useState(false);
  const [, startTransition] = useTransition();

  const current = state.queue[0];

  // Fixed `now` per card so the fuzzed interval previews don't shift between
  // renders (the fuzz seed includes the review time).
  const previews = useMemo(
    () => (current ? previewGrades(toCardState(current)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, current?.nextReviewAt]
  );

  function handleAnswer(grade: SrsGrade) {
    if (!current || !flipped) return;
    const wordId = current.id;
    dispatch({ type: "ANSWER", grade });
    setFlipped(false);
    startTransition(async () => {
      try {
        const { previous } = await submitReview(wordId, grade);
        dispatch({ type: "CONFIRM", wordId, previous });
      } catch {
        toast.error("Failed to save your answer.");
      }
    });
  }

  function handleUndo() {
    const la = state.lastAnswer;
    if (!la?.previous) return;
    const { word, grade, previous } = la;
    dispatch({ type: "UNDO" });
    setFlipped(false);
    startTransition(async () => {
      try {
        await undoReview(word.id, grade, previous);
      } catch {
        toast.error("Failed to undo.");
      }
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      const grade = GRADE_KEYS[e.key];
      if (grade && flipped) {
        e.preventDefault();
        handleAnswer(grade);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!current) {
    return (
      <SessionSummary
        firstTryRemembered={state.correctFirstTry}
        totalCards={state.totalCards}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {aheadOfSchedule && (
        <p className="text-center text-sm text-muted-foreground">
          Nothing due right now — reviewing ahead of schedule.
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <p className="text-center text-sm text-muted-foreground">
          {state.queue.length} card{state.queue.length === 1 ? "" : "s"} left
        </p>
        {state.lastAnswer && (
          <Button
            variant="ghost"
            size="sm"
            disabled={!state.lastAnswer.previous}
            onClick={handleUndo}
          >
            <Undo2 className="size-4" />
            Undo
          </Button>
        )}
      </div>
      <ReviewCard
        word={current}
        flipped={flipped}
        onToggleFlip={() => setFlipped((f) => !f)}
        onSwipeLeft={() => handleAnswer("again")}
        onSwipeRight={() => handleAnswer("good")}
      />
      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(GRADE_LABELS) as SrsGrade[]).map((grade) => (
            <Button
              key={grade}
              variant={GRADE_VARIANTS[grade]}
              className="h-auto flex-col gap-0.5 py-2"
              onClick={() => handleAnswer(grade)}
            >
              <span>{GRADE_LABELS[grade]}</span>
              <span className="text-xs opacity-70">
                {previews ? formatInterval(previews[grade]) : ""}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <Button variant="outline" onClick={() => setFlipped(true)}>
          Show answer
        </Button>
      )}
    </div>
  );
}
