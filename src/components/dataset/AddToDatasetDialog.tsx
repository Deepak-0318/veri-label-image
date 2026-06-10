import { useState } from "react";
import { Dataset } from "@/hooks/useDatasets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddToDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasets: Dataset[];
  onConfirm: (datasetIds: string[]) => void;
  isPending?: boolean;
  fileName?: string;
  fileCount?: number;
}

export function AddToDatasetDialog({
  open,
  onOpenChange,
  datasets,
  onConfirm,
  isPending,
  fileName,
  fileCount,
}: AddToDatasetDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelected(new Set()); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Datasets</DialogTitle>
          <DialogDescription>
            {fileCount && fileCount > 1
              ? `Add ${fileCount} selected files to one or more datasets.`
              : fileName
              ? `Add "${fileName}" to one or more datasets.`
              : "Select datasets to add files to."}
          </DialogDescription>
        </DialogHeader>

        {datasets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No datasets yet. Create one first.
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-1 pr-3">
              {datasets.map((ds) => (
                <label
                  key={ds.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={selected.has(ds.id)}
                    onCheckedChange={() => toggle(ds.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ds.name}</p>
                    {ds.description && (
                      <p className="text-xs text-muted-foreground truncate">{ds.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {ds.file_count ?? 0} files
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || isPending}
          >
            Add to {selected.size} dataset{selected.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
