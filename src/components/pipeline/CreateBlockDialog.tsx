import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { useTheme } from "@/contexts/ThemeContext";
import type { UseMutationResult } from "@tanstack/react-query";

const ICON_OPTIONS = [
  { value: "Zap", label: "⚡ Zap" },
  { value: "Brain", label: "🧠 Brain" },
  { value: "Code", label: "💻 Code" },
  { value: "GitBranch", label: "🔀 Branch" },
  { value: "Globe", label: "🌐 Globe" },
  { value: "FileText", label: "📄 File" },
  { value: "Terminal", label: "▶ Terminal" },
  { value: "Bot", label: "🤖 Bot" },
  { value: "MessageSquare", label: "💬 Message" },
  { value: "Layers", label: "📚 Layers" },
];

const CATEGORY_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "ai", label: "AI Models" },
  { value: "transform", label: "Transforms" },
  { value: "operations", label: "Operations" },
  { value: "condition", label: "Conditions" },
  { value: "io", label: "Input / Output" },
];

const BLOCK_TYPE_OPTIONS = [
  { value: "custom", label: "Custom (Python Script)" },
  { value: "ai", label: "AI Model" },
  { value: "function", label: "Function / Transform" },
  { value: "logical", label: "Condition / Logic" },
  { value: "io", label: "Input / Output" },
];

const defaultScript = `# Custom Python block
def process(data):
    """Process pipeline data.
    
    Args:
        data: Input data from previous block
    Returns:
        Processed data for next block
    """
    # Your logic here
    return data
`;

const pythonExtensions = [python()];

interface CreateBlockDialogProps {
  createTemplate: UseMutationResult<any, Error, any>;
  trigger?: React.ReactNode;
}

export function CreateBlockDialog({ createTemplate, trigger }: CreateBlockDialogProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [blockType, setBlockType] = useState("custom");
  const [icon, setIcon] = useState("Zap");
  const [script, setScript] = useState(defaultScript);

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("custom");
    setBlockType("custom");
    setIcon("Zap");
    setScript(defaultScript);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createTemplate.mutate(
      {
        name: name.trim(),
        category,
        block_type: blockType,
        description: description.trim() || undefined,
        icon,
        default_config: blockType === "custom" ? { script } : {},
        script: blockType === "custom" ? script : undefined,
        language: "python",
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Create Block
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Block</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Block"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this block do?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Block Type</label>
              <Select value={blockType} onValueChange={setBlockType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Icon</label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {blockType === "custom" && (
            <div>
              <label className="text-sm font-medium">Python Script</label>
              <div className="rounded-md overflow-hidden border border-border mt-1">
                <CodeMirror
                  value={script}
                  onChange={setScript}
                  extensions={pythonExtensions}
                  theme={theme === "dark" ? vscodeDark : "light"}
                  height="200px"
                  basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleCreate}
            className="w-full"
            disabled={!name.trim() || createTemplate.isPending}
          >
            {createTemplate.isPending ? "Creating..." : "Create Block"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
