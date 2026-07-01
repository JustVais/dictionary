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
import { addWord, updateWord } from "@/app/(app)/vocabulary/actions";

export function AddWordDialog({ folderId }: { folderId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addWord(folderId, text);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.notFound) {
        toast.warning(`"${text}" was saved, but no definition was found.`);
      }
      setOpen(false);
      setText("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <form onSubmit={handleSubmit} className="grid gap-4">
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
              {pending ? "Looking up…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
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
