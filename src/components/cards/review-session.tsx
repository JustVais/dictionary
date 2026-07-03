"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewCard, CARD_STAGES, STAGE_COUNT } from "./review-card";
import { SessionSummary } from "./session-summary";
import {
  syncReview,
  undoReview,
  type ReviewWord,
  type SrsSnapshot,
} from "@/app/(app)/cards/actions";
import {
  deleteOutbox,
  enqueueOutbox,
  getOutbox,
  listOutbox,
  loadQueue,
  outboxCount,
  outboxWordIds,
  saveQueue,
  type OutboxEntry,
} from "@/lib/offline-store";
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
  // Pre-review scheduling snapshot, derived client-side for offline undo.
  previous: SrsSnapshot;
  // The outcome persisted to the offline outbox and synced to the server.
  entry: OutboxEntry;
}

interface SessionState {
  queue: ReviewWord[];
  answeredIds: Set<string>;
  correctFirstTry: number;
  totalCards: number;
  lastAnswer: LastAnswer | null;
}

type Action =
  | { type: "ANSWER"; grade: SrsGrade; now: Date; reviewId: string }
  | { type: "UNDO" }
  | { type: "LOAD"; words: ReviewWord[] }
  | { type: "DROP"; ids: Set<string> };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "ANSWER": {
      const [current, ...rest] = state.queue;
      if (!current) return state;

      const now = action.now;
      const update = applyFsrs(toCardState(current), action.grade, now);
      const remembered = isRemembered(action.grade);
      const requeued =
        update.nextReviewAt.getTime() - now.getTime() < REQUEUE_WINDOW_MS;

      const rememberedCount = current.rememberedCount + (remembered ? 1 : 0);
      const notRememberedCount =
        current.notRememberedCount + (remembered ? 0 : 1);

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
          rememberedCount,
          notRememberedCount,
        };
        const insertAt = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
        queue = [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
      }

      const wasFirstAnswer = !state.answeredIds.has(current.id);
      const answeredIds = new Set(state.answeredIds);
      answeredIds.add(current.id);

      const entry: OutboxEntry = {
        reviewId: action.reviewId,
        wordId: current.id,
        grade: action.grade,
        reviewedAt: now.toISOString(),
        resulting: {
          fsrsStability: update.stability,
          fsrsDifficulty: update.difficulty,
          fsrsState: update.state,
          fsrsLearningSteps: update.learningSteps,
          nextReviewAt: update.nextReviewAt.toISOString(),
          rememberedCount,
          notRememberedCount,
        },
      };

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
          previous: {
            fsrsStability: current.fsrsStability,
            fsrsDifficulty: current.fsrsDifficulty,
            fsrsState: current.fsrsState,
            fsrsLearningSteps: current.fsrsLearningSteps,
            nextReviewAt: current.nextReviewAt,
            lastReviewedAt: current.lastReviewedAt,
          },
          entry,
        },
      };
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

    case "LOAD":
      return {
        queue: action.words,
        answeredIds: new Set<string>(),
        correctFirstTry: 0,
        totalCards: action.words.length,
        lastAnswer: null,
      };

    case "DROP": {
      const removed = state.queue.filter((w) => action.ids.has(w.id)).length;
      if (removed === 0) return state;
      return {
        ...state,
        queue: state.queue.filter((w) => !action.ids.has(w.id)),
        totalCards: Math.max(0, state.totalCards - removed),
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
  scopeId,
  aheadOfSchedule,
  dueRemaining = 0,
  continueHref,
}: {
  initialWords: ReviewWord[];
  scopeId: string;
  aheadOfSchedule: boolean;
  dueRemaining?: number;
  continueHref?: string;
}) {
  const [state, dispatch] = useReducer(reducer, {
    queue: initialWords,
    answeredIds: new Set<string>(),
    correctFirstTry: 0,
    totalCards: initialWords.length,
    lastAnswer: null,
  });
  const [stage, setStage] = useState(0);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [, startTransition] = useTransition();
  // reviewIds already written to the outbox, so the enqueue effect fires once.
  const enqueuedRef = useRef<Set<string>>(new Set());

  const revealed = stage > CARD_STAGES.WORD;
  const current = state.queue[0];

  // Push queued outcomes to the server, oldest first; stop on the first
  // failure (likely back offline) and leave the rest for the next attempt.
  const flushOutbox = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPendingCount(await outboxCount());
      return;
    }
    const entries = await listOutbox();
    for (const entry of entries) {
      try {
        await syncReview(entry);
        await deleteOutbox(entry.reviewId);
      } catch {
        break;
      }
    }
    setPendingCount(await outboxCount());
  }, []);

  // Bootstrap: flush leftovers, reconcile already-answered cards, and either
  // cache the server queue (online) or restore it from cache (offline).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOnline(navigator.onLine);
      await flushOutbox();
      const pendingIds = await outboxWordIds();
      if (cancelled) return;
      if (pendingIds.size) dispatch({ type: "DROP", ids: pendingIds });
      if (initialWords.length) {
        saveQueue(scopeId, initialWords);
      } else {
        const cached = await loadQueue(scopeId);
        if (!cancelled && cached?.length) {
          dispatch({
            type: "LOAD",
            words: cached.filter((w) => !pendingIds.has(w.id)),
          });
        }
      }
    })();

    const onOnline = () => {
      setOnline(true);
      flushOutbox();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist each new answer to the outbox, then try to sync immediately.
  useEffect(() => {
    const la = state.lastAnswer;
    if (!la || enqueuedRef.current.has(la.entry.reviewId)) return;
    enqueuedRef.current.add(la.entry.reviewId);
    (async () => {
      await enqueueOutbox(la.entry);
      await flushOutbox();
    })();
  }, [state.lastAnswer, flushOutbox]);

  // Fixed `now` per card so the fuzzed interval previews don't shift between
  // renders (the fuzz seed includes the review time).
  const previews = useMemo(
    () => (current ? previewGrades(toCardState(current)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, current?.nextReviewAt]
  );

  function handleAnswer(grade: SrsGrade) {
    if (!current || !revealed) return;
    dispatch({ type: "ANSWER", grade, now: new Date(), reviewId: crypto.randomUUID() });
    setStage(CARD_STAGES.WORD);
  }

  function handleUndo() {
    const la = state.lastAnswer;
    if (!la) return;
    const { word, grade, previous, entry } = la;
    dispatch({ type: "UNDO" });
    setStage(CARD_STAGES.WORD);
    enqueuedRef.current.delete(entry.reviewId);
    startTransition(async () => {
      try {
        const pending = await getOutbox(entry.reviewId);
        if (pending) {
          await deleteOutbox(entry.reviewId); // never reached the server
        } else if (navigator.onLine) {
          await undoReview(word.id, grade, previous); // reverse a synced review
        }
        setPendingCount(await outboxCount());
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
        setStage((s) => (s + 1) % STAGE_COUNT);
        return;
      }
      const grade = GRADE_KEYS[e.key];
      if (grade && revealed) {
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
        dueRemaining={dueRemaining}
        continueHref={continueHref}
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
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <p className="text-center text-sm text-muted-foreground">
          {state.queue.length} card{state.queue.length === 1 ? "" : "s"} left
        </p>
        {!online && (
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Offline
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {pendingCount} pending sync
          </span>
        )}
        {state.lastAnswer && (
          <Button variant="ghost" size="sm" onClick={handleUndo}>
            <Undo2 className="size-4" />
            Undo
          </Button>
        )}
      </div>
      <ReviewCard
        word={current}
        stage={stage}
        onCycle={() => setStage((s) => (s + 1) % STAGE_COUNT)}
      />
      {revealed ? (
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
        <Button
          variant="outline"
          onClick={() => setStage(CARD_STAGES.DEFINITION)}
        >
          Show answer
        </Button>
      )}
    </div>
  );
}
