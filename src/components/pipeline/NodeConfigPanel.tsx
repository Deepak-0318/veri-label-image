import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PipelineNodeData } from "./PipelineNode";

const pythonExtensions = [python()];
const defaultScript = `# Custom Python block
def process(data):
    """Process pipeline data."""
    # Your logic here
    return data
`;

function CustomScriptEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { theme } = useTheme();
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">Python Script</label>
      <div className="rounded-md overflow-hidden border border-border">
        <CodeMirror
          value={value || defaultScript}
          onChange={onChange}
          extensions={pythonExtensions}
          theme={theme === "dark" ? vscodeDark : "light"}
          height="220px"
          basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
          className="text-xs"
        />
      </div>
    </div>
  );
}

interface NodeConfigPanelProps {
  nodeId: string;
  data: PipelineNodeData;
  onUpdate: (updates: Partial<PipelineNodeData>) => void;
  onDelete: () => void;
}

export function NodeConfigPanel({
  nodeId,
  data,
  onUpdate,
  onDelete,
}: NodeConfigPanelProps) {
  const updateConfig = (key: string, value: any) => {
    onUpdate({ config: { ...data.config, [key]: value } });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Block Configuration</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Name</label>
          <Input
            value={data.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="bg-secondary/50"
          />
        </div>

      {data.blockType === "ai" && (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Model
            </label>
            <Select
              value={data.config.model || "GroundingDINO"}
              onValueChange={(v) => updateConfig("model", v)}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GroundingDINO">GroundingDINO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Confidence Threshold
            </label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={data.config.confidence ?? 0.5}
              onChange={(e) =>
                updateConfig(
                  "confidence",
                  parseFloat(e.target.value) || 0
                )
              }
              className="bg-secondary/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Max Detections
            </label>
            <Input
              type="number"
              min="1"
              max="100"
              step="1"
              value={data.config.maxDetections ?? 10}
              onChange={(e) =>
                updateConfig(
                  "maxDetections",
                  parseInt(e.target.value, 10) || 1
                )
              }
              className="bg-secondary/50"
            />
          </div>
        </>
      )}

        {data.blockType === "function" && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Function</label>
            <Select
              value={data.config.function || "filter"}
              onValueChange={(v) => updateConfig("function", v)}
            >
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="filter">Filter</SelectItem>
                <SelectItem value="map">Map / Transform</SelectItem>
                <SelectItem value="aggregate">Aggregate</SelectItem>
                <SelectItem value="merge">Merge Segments</SelectItem>
                <SelectItem value="split">Split Segments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {data.blockType === "logical" && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Condition Expression</label>
            <Textarea
              value={data.config.condition || ""}
              onChange={(e) => updateConfig("condition", e.target.value)}
              placeholder='e.g. segment.duration > 2.0 && segment.type === "speech"'
              className="bg-secondary/50 font-mono text-xs"
              rows={3}
            />
          </div>
        )}

        {data.blockType === "custom" && (
          <CustomScriptEditor
            value={data.config.script || ""}
            onChange={(val) => updateConfig("script", val)}
          />
        )}
      </div>
    </div>
  );
}
