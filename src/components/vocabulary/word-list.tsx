"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddWordDialog, EditWordDialog, type EditableWord } from "./word-dialog";
import { deleteWord } from "@/app/(app)/vocabulary/actions";

export interface WordRow extends EditableWord {
  rememberedCount: number;
  notRememberedCount: number;
  forms: string[];
}

export function WordList({
  folderId,
  folderName,
  words,
}: {
  folderId: string;
  folderName: string;
  words: WordRow[];
}) {
  const [, startTransition] = useTransition();
  const [editingWord, setEditingWord] = useState<WordRow | null>(null);

  function handleDelete(wordId: string, text: string) {
    if (!window.confirm(`Delete "${text}"?`)) return;
    startTransition(async () => {
      try {
        await deleteWord(wordId);
      } catch {
        toast.error("Failed to delete word.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Link href="/vocabulary">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="flex-1 text-lg font-semibold">{folderName}</h1>
        <AddWordDialog folderId={folderId} />
      </div>

      {words.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No words yet. Add one to get started.
        </p>
      ) : (
        <div className="grid gap-2">
          {words.map((word) => {
            const total = word.rememberedCount + word.notRememberedCount;
            const accuracy =
              total > 0 ? Math.round((word.rememberedCount / total) * 100) : null;
            return (
              <Card key={word.id} className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{word.text}</div>
                    {word.definition && (
                      <p className="text-sm text-muted-foreground">
                        {word.definition}
                      </p>
                    )}
                    {word.forms.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {[word.text, ...word.forms].join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingWord(word)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(word.id, word.text)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {word.rememberedCount} remembered · {word.notRememberedCount} missed
                  {accuracy !== null && ` · ${accuracy}% accuracy`}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editingWord && (
        <EditWordDialog
          word={editingWord}
          open={!!editingWord}
          onOpenChange={(open) => !open && setEditingWord(null)}
        />
      )}
    </div>
  );
}
