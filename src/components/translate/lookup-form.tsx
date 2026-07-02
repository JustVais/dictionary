"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DefinitionView } from "./definition-view";
import {
  lookupWordAction,
  addLookedUpWordToFolder,
} from "@/app/(app)/translate/actions";
import type { WordDetails } from "@/lib/dictionary";

export function LookupForm({
  folders,
}: {
  folders: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<WordDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | undefined>(folders[0]?.id);
  const [pending, startTransition] = useTransition();
  const [saving, startSaveTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await lookupWordAction(query);
      if (!res.ok) {
        setError(res.reason);
        setResult(null);
        return;
      }
      setResult(res.details);
    });
  }

  function handleAddToFolder() {
    if (!result || !folderId) return;
    startSaveTransition(async () => {
      try {
        await addLookedUpWordToFolder(folderId, result);
        toast.success(`Added "${result.word}" to folder.`);
      } catch {
        toast.error("Failed to add word.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Translate</h1>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter an English word"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Looking up…" : "Look up"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <Card className="grid gap-4 p-4">
          <DefinitionView
            word={result.word}
            phoneticText={result.phoneticText}
            partOfSpeech={result.partOfSpeech}
            definition={result.definition}
            example={result.example}
          />
          {folders.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={folderId}
                onValueChange={(value) => setFolderId(value ?? undefined)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddToFolder} disabled={saving || !folderId}>
                Add to folder
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
