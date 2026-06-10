import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Check, X, Sliders, AlertCircle } from "lucide-react";
import {
  useProjectVariables,
  ProjectVariable,
  VariableType,
} from "@/hooks/useProjectVariables";

interface ProjectVariableManagerProps {
  projectId: string;
  userId: string;
}

const TYPE_LABELS: Record<VariableType, string> = {
  number: "Number",
  text: "Text",
  single_select: "Single selection",
  multi_select: "Multi selection",
};

interface DraftState {
  name: string;
  description: string;
  variable_type: VariableType;
  options: string[];
  is_required: boolean;
  min_value: string;
  max_value: string;
}

const emptyDraft = (): DraftState => ({
  name: "",
  description: "",
  variable_type: "text",
  options: [],
  is_required: false,
  min_value: "",
  max_value: "",
});

function fromVariable(v: ProjectVariable): DraftState {
  return {
    name: v.name,
    description: v.description || "",
    variable_type: v.variable_type,
    options: v.options || [],
    is_required: v.is_required,
    min_value: v.min_value !== null && v.min_value !== undefined ? String(v.min_value) : "",
    max_value: v.max_value !== null && v.max_value !== undefined ? String(v.max_value) : "",
  };
}

export function ProjectVariableManager({ projectId, userId }: ProjectVariableManagerProps) {
  const { variables, createVariable, updateVariable, deleteVariable } =
    useProjectVariables(projectId);

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [newOption, setNewOption] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(emptyDraft());
  const [editNewOption, setEditNewOption] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const isSelectType = (t: VariableType) => t === "single_select" || t === "multi_select";

  const validate = (d: DraftState): string | null => {
    if (!d.name.trim()) return "Name is required";
    if (isSelectType(d.variable_type) && d.options.length === 0)
      return "Add at least one option";
    if (d.variable_type === "number") {
      if (d.min_value !== "" && isNaN(Number(d.min_value))) return "Min must be a number";
      if (d.max_value !== "" && isNaN(Number(d.max_value))) return "Max must be a number";
      if (
        d.min_value !== "" &&
        d.max_value !== "" &&
        Number(d.min_value) > Number(d.max_value)
      )
        return "Min cannot be greater than Max";
    }
    return null;
  };

  const handleCreate = () => {
    const err = validate(draft);
    if (err) return;
    createVariable.mutate(
      {
        userId,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        variable_type: draft.variable_type,
        options: isSelectType(draft.variable_type) ? draft.options : [],
        is_required: draft.is_required,
        min_value:
          draft.variable_type === "number" && draft.min_value !== ""
            ? Number(draft.min_value)
            : null,
        max_value:
          draft.variable_type === "number" && draft.max_value !== ""
            ? Number(draft.max_value)
            : null,
      },
      {
        onSuccess: () => {
          setDraft(emptyDraft());
          setNewOption("");
          setShowAdd(false);
        },
      }
    );
  };

  const startEdit = (v: ProjectVariable) => {
    setEditingId(v.id);
    setEditDraft(fromVariable(v));
    setEditNewOption("");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const err = validate(editDraft);
    if (err) return;
    updateVariable.mutate(
      {
        id: editingId,
        name: editDraft.name.trim(),
        description: editDraft.description.trim() || null,
        variable_type: editDraft.variable_type,
        options: isSelectType(editDraft.variable_type) ? editDraft.options : [],
        is_required: editDraft.is_required,
        min_value:
          editDraft.variable_type === "number" && editDraft.min_value !== ""
            ? Number(editDraft.min_value)
            : null,
        max_value:
          editDraft.variable_type === "number" && editDraft.max_value !== ""
            ? Number(editDraft.max_value)
            : null,
      },
      {
        onSuccess: () => {
          setEditingId(null);
        },
      }
    );
  };

  const validationError = showAdd ? validate(draft) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sliders className="h-4 w-4 text-muted-foreground" />
          Variables
          <Badge variant="secondary" className="text-[10px] h-4">
            {variables.length}
          </Badge>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setShowAdd(!showAdd);
            setDraft(emptyDraft());
            setNewOption("");
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Variable
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Custom parameters that annotators can fill in for each annotation in this project.
      </p>

      {showAdd && (
        <DraftEditor
          draft={draft}
          setDraft={setDraft}
          newOption={newOption}
          setNewOption={setNewOption}
          onCancel={() => {
            setShowAdd(false);
            setDraft(emptyDraft());
          }}
          onSubmit={handleCreate}
          submitLabel="Create Variable"
          error={validationError}
        />
      )}

      {variables.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No variables defined yet.
        </p>
      )}

      <div className="space-y-2">
        {variables.map((v) => {
          const isEditing = editingId === v.id;
          if (isEditing) {
            return (
              <div key={v.id} className="rounded-lg border border-border bg-card/50 p-3">
                <DraftEditor
                  draft={editDraft}
                  setDraft={setEditDraft}
                  newOption={editNewOption}
                  setNewOption={setEditNewOption}
                  onCancel={() => setEditingId(null)}
                  onSubmit={handleSaveEdit}
                  submitLabel="Save Changes"
                  error={validate(editDraft)}
                />
              </div>
            );
          }
          return (
            <div
              key={v.id}
              className="rounded-lg border border-border bg-card/50 p-3 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{v.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {TYPE_LABELS[v.variable_type]}
                  </Badge>
                  {v.is_required && (
                    <Badge variant="destructive" className="text-[10px] h-4">
                      Required
                    </Badge>
                  )}
                </div>
                {v.description && (
                  <p className="text-xs text-muted-foreground">{v.description}</p>
                )}
                {v.variable_type === "number" &&
                  (v.min_value !== null || v.max_value !== null) && (
                    <p className="text-[11px] text-muted-foreground">
                      Range: {v.min_value ?? "−∞"} to {v.max_value ?? "+∞"}
                    </p>
                  )}
                {(v.variable_type === "single_select" ||
                  v.variable_type === "multi_select") && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {v.options.map((opt) => (
                      <Badge key={opt} variant="secondary" className="text-[10px] h-4">
                        {opt}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => startEdit(v)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTargetId(v.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this variable?</AlertDialogTitle>
            <AlertDialogDescription>
              All values entered for this variable on existing annotations will also be
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) deleteVariable.mutate(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DraftEditorProps {
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  newOption: string;
  setNewOption: (s: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  error: string | null;
}

function DraftEditor({
  draft,
  setDraft,
  newOption,
  setNewOption,
  onCancel,
  onSubmit,
  submitLabel,
  error,
}: DraftEditorProps) {
  const isSelectType =
    draft.variable_type === "single_select" || draft.variable_type === "multi_select";

  const addOption = () => {
    const v = newOption.trim();
    if (!v) return;
    if (draft.options.includes(v)) return;
    setDraft({ ...draft, options: [...draft.options, v] });
    setNewOption("");
  };

  const removeOption = (opt: string) => {
    setDraft({ ...draft, options: draft.options.filter((o) => o !== opt) });
  };

  return (
    <div className="space-y-3 p-3 bg-secondary/50 rounded-lg border border-border">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input
          placeholder="e.g. Confidence, Severity..."
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Description (optional)
        </label>
        <Textarea
          placeholder="Help text shown to annotators..."
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="text-sm min-h-[50px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select
            value={draft.variable_type}
            onValueChange={(val) =>
              setDraft({ ...draft, variable_type: val as VariableType })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="single_select">Single selection</SelectItem>
              <SelectItem value="multi_select">Multi selection</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs cursor-pointer h-8">
            <Checkbox
              checked={draft.is_required}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, is_required: checked === true })
              }
            />
            <span>Required</span>
          </label>
        </div>
      </div>

      {draft.variable_type === "number" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Min</label>
            <Input
              type="number"
              placeholder="No minimum"
              value={draft.min_value}
              onChange={(e) => setDraft({ ...draft, min_value: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Max</label>
            <Input
              type="number"
              placeholder="No maximum"
              value={draft.max_value}
              onChange={(e) => setDraft({ ...draft, max_value: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {isSelectType && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Options</label>
          <div className="flex gap-1">
            <Input
              placeholder="Add option..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={addOption}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {draft.options.map((opt) => (
              <Badge
                key={opt}
                variant="secondary"
                className="text-[10px] h-5 gap-1 pl-2 pr-1"
              >
                {opt}
                <button
                  type="button"
                  onClick={() => removeOption(opt)}
                  className="hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={onSubmit}
          disabled={!!error}
        >
          <Check className="h-3 w-3 mr-1" />
          {submitLabel}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}