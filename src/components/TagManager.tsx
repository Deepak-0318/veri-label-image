import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TagBadge } from "./TagBadge";
import { useAuth } from "@/hooks/useAuth";
import { useLabels } from "@/hooks/useLabels";
import { TagColor } from "@/types/annotation";
import { toast } from "sonner";

const colors: TagColor[] = ['blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'cyan', 'red'];

const colorDotMap: Record<TagColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
  red: 'bg-red-500',
};

interface TagManagerProps {
  className?: string;
}

export function TagManager({ className }: TagManagerProps) {
  const { user } = useAuth();
  const { labels, createLabel } = useLabels(user?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");

  const filteredLabels = labels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    if (!user) {
      toast.error("Sign in to create labels");
      return;
    }
    createLabel.mutate(
      { label: { name: newName.trim(), color: newColor }, userId: user.id },
      { onSuccess: () => { setNewName(""); setIsAdding(false); } }
    );
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">Labels</h3>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="h-4 w-4" />
          Add Label
        </Button>
      </div>

      {isAdding && (
        <div className="space-y-2 p-3 mb-4 bg-secondary/50 rounded-lg">
          <Input
            placeholder="Label name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsAdding(false);
            }}
          />
          <div className="flex gap-1.5 flex-wrap">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={cn(
                  "w-6 h-6 rounded-full transition-transform",
                  colorDotMap[color],
                  newColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={createLabel.isPending}>
              {createLabel.isPending ? "Creating..." : "Create"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search labels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-secondary/50 border-transparent focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {filteredLabels.map((label) => (
          <div
            key={label.id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
          >
            <TagBadge label={label.name} color={label.color} />
          </div>
        ))}

        {filteredLabels.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No labels found
          </p>
        )}
      </div>
    </div>
  );
}
