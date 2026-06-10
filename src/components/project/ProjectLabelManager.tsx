import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, Layers, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectLabelTypes, useProjectLabels } from "@/hooks/useProjectLabels";
import { TagColor } from "@/types/annotation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface ProjectLabelManagerProps {
  projectId: string;
  userId: string;
}

export function ProjectLabelManager({ projectId, userId }: ProjectLabelManagerProps) {
  const { labelTypes, createLabelType, deleteLabelType, updateLabelType } = useProjectLabelTypes(projectId);
  const { projectLabels, createLabel, deleteLabel, updateLabel } = useProjectLabels(projectId);

  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");

  const [addingLabelForType, setAddingLabelForType] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<TagColor>('blue');

  // Editing state for label types
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeDesc, setEditTypeDesc] = useState("");

  // Editing state for labels
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState<TagColor>('blue');

  const handleCreateType = () => {
    if (!newTypeName.trim()) return;
    createLabelType.mutate({ name: newTypeName.trim(), description: newTypeDesc.trim() || undefined, userId });
    setNewTypeName("");
    setNewTypeDesc("");
    setShowAddType(false);
  };

  const handleCreateLabel = (labelTypeId: string) => {
    if (!newLabelName.trim()) return;
    createLabel.mutate({ labelTypeId, name: newLabelName.trim(), color: newLabelColor, userId });
    setNewLabelName("");
    setNewLabelColor('blue');
    setAddingLabelForType(null);
  };

  const startEditType = (lt: { id: string; name: string; description: string | null }) => {
    setEditingTypeId(lt.id);
    setEditTypeName(lt.name);
    setEditTypeDesc(lt.description || "");
  };

  const saveEditType = () => {
    if (!editingTypeId || !editTypeName.trim()) return;
    updateLabelType.mutate({ id: editingTypeId, name: editTypeName.trim(), description: editTypeDesc.trim() || undefined });
    setEditingTypeId(null);
  };

  const startEditLabel = (label: { id: string; name: string; color: TagColor }) => {
    setEditingLabelId(label.id);
    setEditLabelName(label.name);
    setEditLabelColor(label.color);
  };

  const saveEditLabel = () => {
    if (!editingLabelId || !editLabelName.trim()) return;
    updateLabel.mutate({ id: editingLabelId, name: editLabelName.trim(), color: editLabelColor });
    setEditingLabelId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Label Types & Labels
        </h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddType(!showAddType)}>
          <Plus className="h-3 w-3 mr-1" />
          Add Type
        </Button>
      </div>

      {showAddType && (
        <div className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border">
          <Input
            placeholder="Label type name (e.g. Sentiment, Entity)..."
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateType(); if (e.key === 'Escape') setShowAddType(false); }}
          />
          <Textarea
            placeholder="Description (optional)..."
            value={newTypeDesc}
            onChange={(e) => setNewTypeDesc(e.target.value)}
            className="text-sm min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreateType} disabled={!newTypeName.trim()}>
              Create Type
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddType(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {labelTypes.length === 0 && !showAddType && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No label types defined yet. Add label types to organize your labels.
        </p>
      )}

      <div className="space-y-2">
        {labelTypes.map((lt) => {
          const labelsForType = projectLabels.filter(l => l.label_type_id === lt.id);
          return (
            <Collapsible key={lt.id} defaultOpen>
              <div className="rounded-lg border border-border bg-card/50">
                <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    {editingTypeId === lt.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editTypeName}
                          onChange={(e) => setEditTypeName(e.target.value)}
                          className="h-7 text-sm w-40"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditType(); if (e.key === 'Escape') setEditingTypeId(null); }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={(e) => { e.stopPropagation(); saveEditType(); }}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingTypeId(null); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium">{lt.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-4">{labelsForType.length}</Badge>
                      </>
                    )}
                  </div>
                  {editingTypeId !== lt.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); startEditType(lt); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteLabelType.mutate(lt.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-2 space-y-1.5">
                    {lt.description && (
                      <p className="text-xs text-muted-foreground">{lt.description}</p>
                    )}
                    {labelsForType.map((label) => (
                      <div key={label.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50">
                        {editingLabelId === label.id ? (
                          <>
                            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorMap[editLabelColor])} />
                            <Input
                              value={editLabelName}
                              onChange={(e) => setEditLabelName(e.target.value)}
                              className="h-6 text-xs flex-1"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditLabel(); if (e.key === 'Escape') setEditingLabelId(null); }}
                            />
                            <div className="flex gap-0.5 flex-wrap">
                              {colors.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setEditLabelColor(c)}
                                  className={cn(
                                    "w-4 h-4 rounded-full transition-transform",
                                    colorMap[c],
                                    editLabelColor === c && "ring-2 ring-offset-1 ring-offset-background ring-foreground scale-110"
                                  )}
                                />
                              ))}
                            </div>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" onClick={saveEditLabel}>
                              <Check className="h-2.5 w-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingLabelId(null)}>
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className={cn("w-2.5 h-2.5 rounded-full", colorMap[label.color])} />
                            <span className="text-xs flex-1">{label.name}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => startEditLabel(label)}>
                              <Pencil className="h-2.5 w-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => deleteLabel.mutate(label.id)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}

                    {addingLabelForType === lt.id ? (
                      <div className="space-y-2 p-2 bg-muted/50 rounded">
                        <Input
                          placeholder="Label name..."
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          className="h-7 text-xs"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLabel(lt.id); if (e.key === 'Escape') setAddingLabelForType(null); }}
                        />
                        <div className="flex gap-1 flex-wrap">
                          {colors.map((c) => (
                            <button
                              key={c}
                              onClick={() => setNewLabelColor(c)}
                              className={cn(
                                "w-5 h-5 rounded-full transition-transform",
                                colorMap[c],
                                newLabelColor === c && "ring-2 ring-offset-1 ring-offset-background ring-foreground scale-110"
                              )}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => handleCreateLabel(lt.id)}>
                            Add
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setAddingLabelForType(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] w-full"
                        onClick={() => setAddingLabelForType(lt.id)}
                      >
                        <Plus className="h-2.5 w-2.5 mr-1" />
                        Add Label
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
