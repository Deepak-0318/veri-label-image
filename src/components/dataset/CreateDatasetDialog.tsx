import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface Props {
  createDataset: UseMutationResult<any, Error, { name: string; description?: string }>;
}

export function CreateDatasetDialog({ createDataset }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    createDataset.mutate({ name: name.trim(), description: description.trim() || undefined }, {
      onSuccess: () => {
        setOpen(false);
        setName("");
        setDescription("");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Dataset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Dataset</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="e.g. Training Images Batch 1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea placeholder="What this dataset contains..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || createDataset.isPending}>
              {createDataset.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
