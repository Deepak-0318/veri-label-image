import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Group, Pencil, Check, X } from "lucide-react";
import { useGroupTypes } from "@/hooks/useGroupTypes";

interface ProjectGroupTypeManagerProps {
  projectId: string;
  userId: string;
}

export function ProjectGroupTypeManager({ projectId, userId }: ProjectGroupTypeManagerProps) {
  const { groupTypes, createGroupType, deleteGroupType, updateGroupType } = useGroupTypes(projectId);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createGroupType.mutate({ name: newName.trim(), userId });
    setNewName("");
    setShowAdd(false);
  };

  const startEdit = (gt: { id: string; name: string }) => {
    setEditingId(gt.id);
    setEditName(gt.name);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateGroupType.mutate({ id: editingId, name: editName.trim() });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Group className="h-4 w-4 text-muted-foreground" />
          Group Types
        </h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3 mr-1" />
          Add Group Type
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Group types let you categorize annotations into logical groups (e.g., different robots in the same video). A "Default" group is always available.
      </p>

      {showAdd && (
        <div className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border">
          <Input
            placeholder="Group type name (e.g. Robot A, Camera 1)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowAdd(false);
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
          <span className="text-sm flex-1 font-medium">Default</span>
          <Badge variant="secondary" className="text-[10px] h-4">built-in</Badge>
        </div>

        {groupTypes.map((gt) => (
          <div key={gt.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
            {editingId === gt.id ? (
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
                <span className="text-sm flex-1">{gt.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEdit(gt)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteGroupType.mutate(gt.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}

        {groupTypes.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Only the default group is defined. Add more to categorize annotations.
          </p>
        )}
      </div>
    </div>
  );
}
