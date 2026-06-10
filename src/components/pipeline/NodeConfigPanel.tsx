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

export function NodeConfigPanel({ nodeId, data, onUpdate, onDelete }: NodeConfigPanelProps) {
  const updateConfig = (key: string, value: string) => {
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
              <label className="text-xs text-muted-foreground mb-1 block">Model</label>
              <Select
                value={data.config.model || "whisper"}
                onValueChange={(v) => updateConfig("model", v)}
              >
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whisper">Whisper (Speech-to-Text)</SelectItem>
                  <SelectItem value="pyannote">Pyannote (Speaker Diarization)</SelectItem>
                  <SelectItem value="wav2vec">Wav2Vec (Speech Segmentation)</SelectItem>
                  <SelectItem value="emotion-recognition">Emotion Recognition</SelectItem>
                  <SelectItem value="custom-model">Custom Model</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Task</label>
              <Select
                value={data.config.task || "transcription"}
                onValueChange={(v) => updateConfig("task", v)}
              >
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transcription">Transcript Generation</SelectItem>
                  <SelectItem value="speaker-segmentation">Speaker Segmentation</SelectItem>
                  <SelectItem value="speech-segmentation">Speech Segmentation</SelectItem>
                  <SelectItem value="emotion-recognition">Emotion Recognition</SelectItem>
                  <SelectItem value="classification">Classification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* LLM-specific config */}
            {(data.config.provider !== undefined || data.label?.toLowerCase().includes("llm")) && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
                  <Select
                    value={data.config.provider || "openai"}
                    onValueChange={(v) => updateConfig("provider", v)}
                  >
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                      <SelectItem value="huggingface">HuggingFace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Temperature</label>
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={data.config.temperature ?? 0.7}
                    onChange={(e) => updateConfig("temperature", e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Prompt</label>
                  <Textarea
                    value={data.config.prompt || ""}
                    onChange={(e) => updateConfig("prompt", e.target.value)}
                    placeholder="System prompt or instructions..."
                    className="bg-secondary/50 text-xs"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Agentic AI-specific config */}
            {(data.config.max_iterations !== undefined || data.label?.toLowerCase().includes("agentic")) && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Goal</label>
                  <Textarea
                    value={data.config.goal || ""}
                    onChange={(e) => updateConfig("goal", e.target.value)}
                    placeholder="Define the agent's objective..."
                    className="bg-secondary/50 text-xs"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max Iterations</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={data.config.max_iterations ?? 10}
                    onChange={(e) => updateConfig("max_iterations", e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
              </>
            )}
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
