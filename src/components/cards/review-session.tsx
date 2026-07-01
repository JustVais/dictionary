"use client";

import { useReducer, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "./review-card";
import { SessionSummary } from "./session-summary";
import { submitReview, type ReviewWord } from "@/app/(app)/cards/actions";
import type { SrsGrade } from "@/lib/srs";

interface SessionState {
  queue: ReviewWord[];
  missedIds: Set<string>;
  correctFirstTry: number;
  totalCards: number;
}

type Action = { type: "ANSWER"; grade: SrsGrade };

function reducer(state: SessionState, action: Action): SessionState {
  const [current, ...rest] = state.queue;
  if (!current) return state;

  if (action.grade === "remembered") {
    const wasFirstTry = !state.missedIds.has(current.id);
    return {
      ...state,
      queue: rest,
      correctFirstTry: state.correctFirstTry + (wasFirstTry ? 1 : 0),
    };
  }

  const insertAt = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
  const queue = [...rest.slice(0, insertAt), current, ...rest.slice(insertAt)];
  const missedIds = new Set(state.missedIds);
  missedIds.add(current.id);
  return { ...state, queue, missedIds };
}

export function ReviewSession({
  initialWords,
  aheadOfSchedule,
}: {
  initialWords: ReviewWord[];
  aheadOfSchedule: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, {
    queue: initialWords,
    missedIds: new Set<string>(),
    correctFirstTry: 0,
    totalCards: initialWords.length,
  });
  const [flipped, setFlipped] = useState(false);
  const [, startTransition] = useTransition();

  const current = state.queue[0];

  function handleAnswer(grade: SrsGrade) {
    if (!current) return;
    dispatch({ type: "ANSWER", grade });
    setFlipped(false);
    startTransition(async () => {
      try {
        await submitReview(current.id, grade);
      } catch {
        toast.error("Failed to save your answer.");
      }
    });
  }

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
      <p className="text-center text-sm text-muted-foreground">
        {state.queue.length} card{state.queue.length === 1 ? "" : "s"} left
      </p>
      <ReviewCard
        word={current}
        flipped={flipped}
        onToggleFlip={() => setFlipped((f) => !f)}
        onSwipeLeft={() => handleAnswer("not_remembered")}
        onSwipeRight={() => handleAnswer("remembered")}
      />
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => handleAnswer("not_remembered")}
        >
          I don&apos;t remember
        </Button>
        <Button onClick={() => handleAnswer("remembered")}>
          I remember
        </Button>
      </div>
    </div>
  );
}
