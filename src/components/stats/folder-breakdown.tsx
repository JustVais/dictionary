import { Card } from "@/components/ui/card";
import type { FolderBreakdownRow } from "@/app/(app)/stats/queries";

export function FolderBreakdown({ rows }: { rows: FolderBreakdownRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-medium">Folder breakdown</h2>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.folderId} className="flex items-center justify-between text-sm">
            <span>{row.folderName}</span>
            <span className="text-muted-foreground">{row.accuracy}% accuracy</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
