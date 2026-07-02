"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addWordWithDetails,
  lookupForAdd,
  updateWord,
} from "@/app/(app)/vocabulary/actions";
import type { WordDetails, WordSense } from "@/lib/dictionary";
import { cn } from "@/lib/utils";

export function AddWordDialog({ folderId }: { folderId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [senseIndex, setSenseIndex] = useState(0);
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [pending, startTransition] = useTransition();

  const senses = details?.senses ?? [];

  function reset() {
    setText("");
    setDetails(null);
    setSenseIndex(0);
    setDefinition("");
    setExample("");
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await lookupForAdd(text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.found) {
        toast.warning("No definition found — you can write your own.");
      }
      setDetails(result.details);
      setSenseIndex(0);
      setDefinition(result.details.definition ?? "");
      setExample(result.details.example ?? "");
    });
  }

  function selectSense(index: number, sense: WordSense) {
    setSenseIndex(index);
    setDefinition(sense.definition);
    setExample(sense.example ?? "");
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!details) return;
    const sense = senses[senseIndex];
    startTransition(async () => {
      const result = await addWordWithDetails(folderId, {
        ...details,
        definition,
        example,
        partOfSpeech: sense?.partOfSpeech ?? details.partOfSpeech,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.info(result.warning);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add Word
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add word</DialogTitle>
        </DialogHeader>
        {details === null ? (
          <form onSubmit={handleLookup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="word-text">English word</Label>
              <Input
                id="word-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Looking up…" : "Look up"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSave} className="grid gap-4">
            <p className="font-medium">
              {details.word}
              {senses[senseIndex]?.partOfSpeech && (
                <span className="ml-2 text-xs font-normal uppercase text-muted-foreground">
                  {senses[senseIndex].partOfSpeech}
                </span>
              )}
            </p>
            {senses.length > 1 && (
              <div className="grid gap-1.5">
                <Label>Meaning</Label>
                {senses.map((sense, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectSense(index, sense)}
                    className={cn(
                      "rounded-md border p-2 text-left text-sm",
                      index === senseIndex
                        ? "border-primary bg-primary/5"
                        : "text-muted-foreground"
                    )}
                  >
                    {sense.partOfSpeech && (
                      <span className="mr-1 text-xs uppercase">
                        {sense.partOfSpeech} ·
                      </span>
                    )}
                    {sense.definition}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="add-word-definition">Definition</Label>
              <Textarea
                id="add-word-definition"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-word-example">Example</Label>
              <Textarea
                id="add-word-example"
                value={example}
                onChange={(e) => setExample(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetails(null)}
              >
                Back
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface EditableWord {
  id: string;
  text: string;
  definition: string | null;
  example: string | null;
}

export function EditWordDialog({
  word,
  open,
  onOpenChange,
}: {
  word: EditableWord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState(word.text);
  const [definition, setDefinition] = useState(word.definition ?? "");
  const [example, setExample] = useState(word.example ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateWord(word.id, { text, definition, example });
        onOpenChange(false);
      } catch {
        toast.error("Failed to update word.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit word</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-word-text">Word</Label>
            <Input
              id="edit-word-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-word-definition">Definition</Label>
            <Textarea
              id="edit-word-definition"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-word-example">Example</Label>
            <Textarea
              id="edit-word-example"
              value={example}
              onChange={(e) => setExample(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
