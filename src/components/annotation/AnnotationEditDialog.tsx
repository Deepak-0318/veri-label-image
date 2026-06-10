import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Annotation, TagColor } from "@/types/annotation";
import { ProjectLabelType, ProjectLabel } from "@/hooks/useProjectLabels";
import { GroupType } from "@/hooks/useGroupTypes";
import { ProjectFlag } from "@/hooks/useProjectFlags";
import { ProjectVariable } from "@/hooks/useProjectVariables";
import { AnnotationVariableValue } from "@/hooks/useAnnotationVariables";
import { cn } from "@/lib/utils";
import { Flag, Sliders, AlertCircle } from "lucide-react";

const TAG_COLORS: { value: TagColor; label: string; class: string }[] = [
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
  { value: "red", label: "Red", class: "bg-red-500" },
];

interface AnnotationEditDialogProps {
  annotation: Annotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: { label: string; color: TagColor; labelTypeId?: string; comment?: string; groupTypeId?: string; flagIds?: string[]; variableValues?: Record<string, AnnotationVariableValue> }) => void;
  projectLabelTypes?: ProjectLabelType[];
  projectLabels?: ProjectLabel[];
  groupTypes?: GroupType[];
  projectFlags?: ProjectFlag[];
  annotationFlagIds?: string[];
  projectVariables?: ProjectVariable[];
  annotationVariableValues?: Record<string, AnnotationVariableValue>;
  portalContainer?: HTMLElement | null;
}

export function AnnotationEditDialog({
  annotation,
  open,
  onOpenChange,
  onSave,
  projectLabelTypes = [],
  projectLabels = [],
  groupTypes = [],
  projectFlags = [],
  annotationFlagIds = [],
  projectVariables = [],
  annotationVariableValues = {},
  portalContainer,
}: AnnotationEditDialogProps) {
  const [label, setLabel] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState<string>("");
  const [color, setColor] = useState<TagColor>("blue");
  const [labelTypeId, setLabelTypeId] = useState<string>("none");
  const [comment, setComment] = useState("");
  const [groupTypeId, setGroupTypeId] = useState<string>("default");
  const [selectedFlagIds, setSelectedFlagIds] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, AnnotationVariableValue>>({});
  const [variableErrors, setVariableErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (annotation && open) {
      setLabel(annotation.label);
      setColor(annotation.color);
      setLabelTypeId(annotation.labelTypeId || "none");
      setComment(annotation.comment || "");
      setGroupTypeId(annotation.groupTypeId || "default");
      setSelectedFlagIds(annotationFlagIds);
      setVariableValues({ ...annotationVariableValues });
      setVariableErrors({});
      // Try to resolve label ID from name + labelTypeId
      const matchedLabel = projectLabels.find(
        pl => pl.name === annotation.label && 
        (annotation.labelTypeId ? pl.label_type_id === annotation.labelTypeId : true)
      );
      setSelectedLabelId(matchedLabel?.id || "");
    }
    // Only re-initialize form state when the dialog opens or the target annotation changes.
    // Do NOT depend on annotationFlagIds / annotationVariableValues / projectLabels because
    // parents often pass new array/object references on every render (e.g. `map[id] || []`),
    // which would otherwise reset user edits on every keystroke or selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotation?.id, open]);

  const validateVariables = (): boolean => {
    const errors: Record<string, string> = {};
    for (const v of projectVariables) {
      const raw = variableValues[v.id];
      const isEmpty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);

      if (v.is_required && isEmpty) {
        errors[v.id] = "Required";
        continue;
      }
      if (!isEmpty && v.variable_type === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          errors[v.id] = "Must be a number";
        } else if (v.min_value !== null && v.min_value !== undefined && n < v.min_value) {
          errors[v.id] = `Must be ≥ ${v.min_value}`;
        } else if (v.max_value !== null && v.max_value !== undefined && n > v.max_value) {
          errors[v.id] = `Must be ≤ ${v.max_value}`;
        }
      }
    }
    setVariableErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validateVariables()) return;
    // Normalize values (coerce number strings to number)
    const normalized: Record<string, AnnotationVariableValue> = {};
    for (const v of projectVariables) {
      const raw = variableValues[v.id];
      const isEmpty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);
      if (isEmpty) {
        normalized[v.id] = null;
      } else if (v.variable_type === "number") {
        normalized[v.id] = Number(raw);
      } else {
        normalized[v.id] = raw;
      }
    }
    onSave({
      label: label.trim() || annotation?.label || "Object",
      color,
      labelTypeId: labelTypeId === "none" ? undefined : labelTypeId,
      comment: comment.trim() || undefined,
      groupTypeId: groupTypeId === "default" ? undefined : groupTypeId,
      flagIds: selectedFlagIds,
      variableValues: normalized,
    });
    onOpenChange(false);
  };

  const toggleFlag = (flagId: string) => {
    setSelectedFlagIds(prev =>
      prev.includes(flagId) ? prev.filter(f => f !== flagId) : [...prev, flagId]
    );
  };

  const setVarValue = (variableId: string, value: AnnotationVariableValue) => {
    setVariableValues(prev => ({ ...prev, [variableId]: value }));
    if (variableErrors[variableId]) {
      setVariableErrors(prev => {
        const next = { ...prev };
        delete next[variableId];
        return next;
      });
    }
  };

  if (!annotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" container={portalContainer}>
        <DialogHeader>
          <DialogTitle>Edit Annotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Label</label>
            {labelTypeId !== "none" && projectLabels.filter(pl => pl.label_type_id === labelTypeId).length > 0 ? (
              <Select value={selectedLabelId || "__none__"} onValueChange={(val) => {
                const matchedLabel = projectLabels.find(pl => pl.id === val);
                if (matchedLabel) {
                  setSelectedLabelId(matchedLabel.id);
                  setLabel(matchedLabel.name);
                  setColor(matchedLabel.color as TagColor);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select label" />
                </SelectTrigger>
                <SelectContent container={portalContainer}>
                  {projectLabels.filter(pl => pl.label_type_id === labelTypeId).map((pl) => {
                    const typeName = projectLabelTypes.find(lt => lt.id === pl.label_type_id)?.name;
                    return (
                      <SelectItem key={pl.id} value={pl.id}>
                        <span className="flex flex-col">
                          <span>{pl.name}</span>
                          {typeName && (
                            <span className="text-[10px] text-muted-foreground leading-tight">{typeName}</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label name" />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    c.class,
                    color === c.value ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {projectLabelTypes.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Label Type</label>
              <Select value={labelTypeId} onValueChange={setLabelTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select label type" />
                </SelectTrigger>
                <SelectContent container={portalContainer}>
                  <SelectItem value="none">None</SelectItem>
                  {projectLabelTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {groupTypes.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Type</label>
              <Select value={groupTypeId} onValueChange={setGroupTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group type" />
                </SelectTrigger>
                <SelectContent container={portalContainer}>
                  <SelectItem value="default">Default</SelectItem>
                  {groupTypes.map((gt) => (
                    <SelectItem key={gt.id} value={gt.id}>{gt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {projectFlags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Flags
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {projectFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50 cursor-pointer hover:bg-secondary"
                    onClick={() => toggleFlag(flag.id)}
                  >
                    <Checkbox
                      checked={selectedFlagIds.includes(flag.id)}
                      onCheckedChange={(e) => { e; toggleFlag(flag.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm">{flag.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {projectVariables.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                Variables
              </label>
              <div className="space-y-3">
                {projectVariables.map((v) => {
                  const value = variableValues[v.id];
                  const error = variableErrors[v.id];
                  return (
                    <div key={v.id} className="space-y-1">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-medium">{v.name}</span>
                        {v.is_required && (
                          <span className="text-destructive">*</span>
                        )}
                      </div>
                      {v.description && (
                        <p className="text-[11px] text-muted-foreground">{v.description}</p>
                      )}
                      {v.variable_type === "text" && (
                        <Input
                          value={(value as string) || ""}
                          onChange={(e) => setVarValue(v.id, e.target.value)}
                          placeholder="Enter value..."
                          className="h-8 text-sm"
                        />
                      )}
                      {v.variable_type === "number" && (
                        <Input
                          type="number"
                          value={value === null || value === undefined ? "" : String(value)}
                          onChange={(e) => setVarValue(v.id, e.target.value)}
                          placeholder={
                            v.min_value !== null || v.max_value !== null
                              ? `Range: ${v.min_value ?? "−∞"} to ${v.max_value ?? "+∞"}`
                              : "Enter number..."
                          }
                          min={v.min_value ?? undefined}
                          max={v.max_value ?? undefined}
                          className="h-8 text-sm"
                        />
                      )}
                      {v.variable_type === "single_select" && (
                        <Select
                          value={(value as string) || "__none__"}
                          onValueChange={(val) =>
                            setVarValue(v.id, val === "__none__" ? null : val)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent container={portalContainer}>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {v.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {v.variable_type === "multi_select" && (
                        <div className="space-y-1 max-h-32 overflow-y-auto rounded border border-border p-2">
                          {v.options.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No options defined</p>
                          ) : (
                            v.options.map((opt) => {
                              const arr = Array.isArray(value) ? (value as string[]) : [];
                              const checked = arr.includes(opt);
                              return (
                                <label
                                  key={opt}
                                  className="flex items-center gap-2 text-xs cursor-pointer px-1 py-0.5 rounded hover:bg-secondary/50"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      const next = c
                                        ? [...arr, opt]
                                        : arr.filter((o) => o !== opt);
                                      setVarValue(v.id, next);
                                    }}
                                    className="h-3.5 w-3.5"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                      {error && (
                        <div className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Comment</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment about this annotation..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
