"use client";

import { Card } from "@/components/ui/card";
import { DefinitionView } from "@/components/translate/definition-view";
import { useSwipe } from "@/hooks/use-swipe";
import type { ReviewWord } from "@/app/(app)/cards/actions";

export function ReviewCard({
  word,
  flipped,
  onToggleFlip,
  onSwipeLeft,
  onSwipeRight,
}: {
  word: ReviewWord;
  flipped: boolean;
  onToggleFlip: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const { handlers, style } = useSwipe({
    onSwipeLeft,
    onSwipeRight,
    onTap: onToggleFlip,
  });

  return (
    <Card
      {...handlers}
      style={style}
      className="flex min-h-56 cursor-pointer touch-none select-none items-center justify-center p-6 text-center"
    >
      {flipped ? (
        <DefinitionView
          word={word.text}
          phoneticText={word.phoneticText}
          partOfSpeech={word.partOfSpeech}
          definition={word.definition}
          example={word.example}
        />
      ) : (
        <h2 className="text-2xl font-semibold">{word.text}</h2>
      )}
    </Card>
  );
}
