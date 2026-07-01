"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderDialog } from "./folder-dialog";
import { deleteFolder } from "@/app/(app)/vocabulary/actions";

export interface FolderWithCount {
  id: string;
  name: string;
  wordCount: number;
}

export function FolderList({ folders }: { folders: FolderWithCount[] }) {
  const [pending, startTransition] = useTransition();
  const [renamingFolder, setRenamingFolder] = useState<FolderWithCount | null>(
    null
  );

  function handleDelete(folderId: string, name: string) {
    if (!window.confirm(`Delete "${name}" and all its words?`)) return;
    startTransition(async () => {
      try {
        await deleteFolder(folderId);
      } catch {
        toast.error("Failed to delete folder.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Vocabulary</h1>
        <FolderDialog mode="create" />
      </div>

      {folders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No folders yet. Create one to start adding words.
        </p>
      ) : (
        <div className="grid gap-2">
          {folders.map((folder) => (
            <Card key={folder.id} className="flex-row items-center justify-between p-4">
              <Link href={`/vocabulary/${folder.id}`} className="flex-1">
                <div className="font-medium">{folder.name}</div>
                <div className="text-sm text-muted-foreground">
                  {folder.wordCount} word{folder.wordCount === 1 ? "" : "s"}
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" disabled={pending} />
                  }
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setRenamingFolder(folder)}>
                    <Pencil className="size-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDelete(folder.id, folder.name)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      {renamingFolder && (
        <FolderDialog
          mode="rename"
          folderId={renamingFolder.id}
          initialName={renamingFolder.name}
          open={!!renamingFolder}
          onOpenChange={(open) => !open && setRenamingFolder(null)}
        />
      )}
    </div>
  );
}
