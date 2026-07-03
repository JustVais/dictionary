"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { DefinitionView } from "@/components/translate/definition-view";
import {
  translateWordForReview,
  type ReviewWord,
} from "@/app/(app)/cards/actions";

/** Tap cycles through these stages: word → English definition → Russian. */
export const CARD_STAGES = { WORD: 0, DEFINITION: 1, RUSSIAN: 2 } as const;
export const STAGE_COUNT = 3;

export function ReviewCard({
  word,
  stage,
  onCycle,
}: {
  word: ReviewWord;
  stage: number;
  onCycle: () => void;
}) {
  // Cache on-demand translations by word id, for cards missing a stored one.
  const [fetched, setFetched] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const russian = word.translation ?? fetched[word.id] ?? null;

  useEffect(() => {
    if (stage !== CARD_STAGES.RUSSIAN || russian) return;
    let cancelled = false;
    (async () => {
      setTranslating(true);
      try {
        const t = await translateWordForReview(word.id);
        if (!cancelled && t) setFetched((m) => ({ ...m, [word.id]: t }));
      } catch {
        /* leave unresolved; the card shows the offline fallback */
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, word.id]);

  return (
    <Card
      onClick={onCycle}
      className="flex min-h-56 cursor-pointer select-none items-center justify-center p-6 text-center"
    >
      {stage === CARD_STAGES.WORD && (
        <h2 className="text-2xl font-semibold">{word.text}</h2>
      )}

      {stage === CARD_STAGES.DEFINITION && (
        <DefinitionView
          word={word.text}
          phoneticText={word.phoneticText}
          partOfSpeech={word.partOfSpeech}
          definition={word.definition}
          example={word.example}
          forms={word.forms}
        />
      )}

      {stage === CARD_STAGES.RUSSIAN && (
        <div className="grid gap-2">
          <h2 className="text-xl font-semibold">{word.text}</h2>
          {russian ? (
            <p className="text-2xl font-medium">{russian}</p>
          ) : translating ? (
            <p className="text-sm text-muted-foreground">Translating…</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Translation unavailable offline.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
