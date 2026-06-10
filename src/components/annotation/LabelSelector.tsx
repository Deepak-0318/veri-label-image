import { TagColor } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Label {
  id: string;
  name: string;
  color: TagColor;
  labelTypeName?: string;
}

interface LabelSelectorProps {
  labels: Label[];
  activeLabel: string;
  activeLabelId?: string;
  activeColor: TagColor;
  onLabelSelect: (label: string, color: TagColor, labelId?: string) => void;
  onLabelCreate: (label: Label) => void;
  onLabelDelete?: (id: string) => void;
  readOnly?: boolean;
}

const colors: TagColor[] = ['blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'cyan', 'red'];

const colorMap: Record<TagColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
  red: 'bg-red-500',
};

export function LabelSelector({
  labels,
  activeLabel,
  activeLabelId,
  activeColor,
  onLabelSelect,
  onLabelCreate,
  onLabelDelete,
  readOnly = false,
}: LabelSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<TagColor>('blue');

  const handleCreate = () => {
    if (newLabelName.trim()) {
      onLabelCreate({
        id: `label-${Date.now()}`,
        name: newLabelName.trim(),
        color: newLabelColor,
      });
      setNewLabelName("");
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Labels</h3>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-2 p-3 bg-secondary/50 rounded-lg">
          <Input
            placeholder="Label name..."
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
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
                onClick={() => setNewLabelColor(color)}
                className={cn(
                  "w-6 h-6 rounded-full transition-transform",
                  colorMap[color],
                  newLabelColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate}>
              Create
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {labels.map((label) => (
          <div
            key={label.id}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all group",
              (activeLabelId ? activeLabelId === label.id : activeLabel === label.name)
                ? "bg-primary/10 border border-primary/30"
                : "bg-secondary/50 hover:bg-secondary border border-transparent"
            )}
          >
            <button
              onClick={() => onLabelSelect(label.name, label.color, label.id)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <div className={cn("w-3 h-3 rounded-full shrink-0", colorMap[label.color])} />
              <div className="flex flex-col min-w-0">
                <span className="truncate">{label.name}</span>
                {label.labelTypeName && (
                  <span className="text-[10px] text-muted-foreground/70 truncate leading-tight">{label.labelTypeName}</span>
                )}
              </div>
            </button>
            {onLabelDelete && !readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); onLabelDelete(label.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
                title="Delete label"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}