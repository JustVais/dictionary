import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DefinitionViewProps {
  word: string;
  phoneticText?: string | null;
  phoneticAudioUrl?: string | null;
  partOfSpeech?: string | null;
  definition?: string | null;
  example?: string | null;
}

export function DefinitionView({
  word,
  phoneticText,
  phoneticAudioUrl,
  partOfSpeech,
  definition,
  example,
}: DefinitionViewProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{word}</h2>
        {phoneticAudioUrl && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              new Audio(phoneticAudioUrl).play();
            }}
          >
            <Volume2 className="size-4" />
          </Button>
        )}
      </div>
      {phoneticText && (
        <p className="text-sm text-muted-foreground">{phoneticText}</p>
      )}
      {partOfSpeech && (
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {partOfSpeech}
        </p>
      )}
      {definition ? (
        <p className="text-sm">{definition}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No definition available.
        </p>
      )}
      {example && (
        <p className="text-sm text-muted-foreground italic">“{example}”</p>
      )}
    </div>
  );
}
