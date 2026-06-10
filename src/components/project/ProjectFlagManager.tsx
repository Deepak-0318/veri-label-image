import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Flag, Pencil, Check, X } from "lucide-react";
import { useProjectFlags } from "@/hooks/useProjectFlags";

interface ProjectFlagManagerProps {
  projectId: string;
  userId: string;
}

export function ProjectFlagManager({ projectId, userId }: ProjectFlagManagerProps) {
  const { flags, createFlag, deleteFlag, updateFlag } = useProjectFlags(projectId);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createFlag.mutate({ name: newName.trim(), userId });
    setNewName("");
    setShowAdd(false);
  };

  const startEdit = (flag: { id: string; name: string }) => {
    setEditingId(flag.id);
    setEditName(flag.name);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateFlag.mutate({ id: editingId, name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Flag className="h-4 w-4 text-muted-foreground" />
          Annotation Flags
        </h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3 mr-1" />
          Add Flag
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border">
          <Input
            placeholder="Flag name (e.g. Occlusion, Low Quality)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowAdd(false); }}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newName.trim()}>
              Create Flag
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {flags.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No flags defined yet. Add flags to mark unusual findings during annotation.
        </p>
      )}

      <div className="space-y-1.5">
        {flags.map((flag) => (
          <div key={flag.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
            <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {editingId === flag.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={saveEdit}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1">{flag.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEdit(flag)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteFlag.mutate(flag.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
