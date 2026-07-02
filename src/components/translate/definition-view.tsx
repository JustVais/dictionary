export interface DefinitionViewProps {
  word: string;
  phoneticText?: string | null;
  partOfSpeech?: string | null;
  definition?: string | null;
  example?: string | null;
}

export function DefinitionView({
  word,
  phoneticText,
  partOfSpeech,
  definition,
  example,
}: DefinitionViewProps) {
  return (
    <div className="grid gap-2">
      <h2 className="text-xl font-semibold">{word}</h2>
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
