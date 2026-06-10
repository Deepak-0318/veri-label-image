import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Loader2, Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTransformScripts } from "@/hooks/useTransformScripts";
import { useAuth } from "@/hooks/useAuth";

const LOCAL_STORAGE_KEY = "transform_script_code";

const DEFAULT_SCRIPT = `// Std MCAP Export: groups annotations by file, topic, group type, and label type.
// Bounding boxes are converted from xywh to xyxy format.
// Skips videoSegment annotations. Collects comments and flags per group.
//
// Output structure (single file):
// {
//   chunk_id: "filename",
//   events: [
//     { t: 1.23, type: "Object Detection", actor: "Default", boxes: { "car": [x1,y1,x2,y2] }, notes: "...", flags: [...] },
//     ...
//   ]
// }
// For multiple files, returns an array of the above.

function transform(data) {
  function xywhToXyxy(x, y, w, h) {
    return [Math.floor(x), Math.floor(y), Math.floor(x + w), Math.floor(y + h)];
  }

  function convertFile(fileEntry) {
    const name = fileEntry.name;
    const chunkId = name.replace(/\\.[^.]+$/, '');
    const groups = {};

    for (const ann of fileEntry.annotations) {
      const timestamp = ann.data.timestamp;
      const label = ann.label;
      const labelType = ann.label_type || label;
      const topicName = ann.data.topicName || '';
      const groupType = ann.group_type || 'Default';
      const key = name + '::' + topicName + '::' + groupType + '::' + labelType + '::' + timestamp;

      if (ann.type == 'videoSegment')
        continue;

      if (!groups[key]) groups[key] = { timestamp, labelType, groupType, comments: [], flags: [], labels: {} };

      if (ann.type === 'boundingBox') {
        const d = ann.data;
        groups[key].labels[label] = xywhToXyxy(d.x, d.y, d.width, d.height);
      } else {
        if (!(label in groups[key].labels)) {
          groups[key].labels[label] = null;
        }
      }

      if (ann.comment !== "")
        groups[key].comments.push(ann.comment);

      if (ann.flags.length > 0)
        groups[key].flags = [...groups[key].flags, ...ann.flags];
    }

    const events = Object.values(groups)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ timestamp, labelType, groupType, comments, flags, labels }) => {
        const event = { t: Math.round(timestamp * 100) / 100, type: labelType, actor: groupType };
        const boxes = {};
        for (const [lbl, bbox] of Object.entries(labels)) {
          if (bbox !== null) boxes[lbl] = bbox;
        }
        if (Object.keys(boxes).length > 0) event.boxes = boxes;
        if (comments.length > 0) event.notes = comments.join(' ');
        if (flags.length > 0) event.flags = flags;
        return event;
      });

    return { chunk_id: chunkId, events };
  }

  const output = data.files.map(convertFile);
  return JSON.stringify(output.length > 1 ? output : output[0], null, 2);
}`;
interface TransformScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportItem: {
    name: string;
    format: string;
    download_url: string | null;
  } | null;
}

export function TransformScriptDialog({
  open,
  onOpenChange,
  exportItem,
}: TransformScriptDialogProps) {
  const { user } = useAuth();
  const { scripts: savedScripts, upsertScript, deleteScript } = useTransformScripts(user?.id);

  const [script, setScript] = useState("");
  const [outputFormat, setOutputFormat] = useState("json");
  const [isRunning, setIsRunning] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      setScript(saved || DEFAULT_SCRIPT);
      setShowSaveInput(false);
      setSaveName("");
    }
  }, [open]);

  const handleScriptChange = (value: string) => {
    setScript(value);
    localStorage.setItem(LOCAL_STORAGE_KEY, value);
  };

  const handleSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      toast.error("Please enter a name for the script");
      return;
    }
    upsertScript.mutate(
      { name: trimmed, code: script, outputFormat },
      {
        onSuccess: () => {
          setShowSaveInput(false);
          setSaveName("");
          toast.success(`Script "${trimmed}" saved`);
        },
      }
    );
  };

  const handleLoad = (saved: { name: string; code: string; output_format: string }) => {
    setScript(saved.code);
    setOutputFormat(saved.output_format);
    localStorage.setItem(LOCAL_STORAGE_KEY, saved.code);
    toast.success(`Loaded "${saved.name}"`);
  };

  const handleDeleteScript = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScript.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
    });
  };

  const handleRunAndDownload = async () => {
    if (!exportItem?.download_url) {
      toast.error("Download URL not available for this export");
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(exportItem.download_url);
      if (!response.ok) throw new Error("Failed to fetch export file");
      const rawText = await response.text();

      let data: any;
      if (exportItem.format === "json") {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }
      } else {
        data = rawText;
      }

      const wrappedScript = `
        ${script}
        return transform(data);
      `;
      const fn = new Function("data", wrappedScript);
      const result = fn(data);

      if (typeof result !== "string") {
        throw new Error("Transform function must return a string");
      }

      const ext = outputFormat;
      const mimeMap: Record<string, string> = {
        json: "application/json",
        csv: "text/csv",
        txt: "text/plain",
      };
      const blob = new Blob([result], {
        type: mimeMap[ext] || "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportItem.name}_transformed.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Transformation complete — file downloaded");
    } catch (err: any) {
      toast.error(`Transform error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transform Export</DialogTitle>
          <DialogDescription>
            Write a JavaScript <code>transform(data)</code> function to convert
            the export into a different format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Save / Load toolbar */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Load
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {savedScripts.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No saved scripts
                  </DropdownMenuItem>
                ) : (
                  savedScripts.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => handleLoad(s)}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate mr-2">{s.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={(e) => handleDeleteScript(s.id, s.name, e)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {showSaveInput ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Script name…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={handleSave} disabled={upsertScript.isPending}>
                  {upsertScript.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSaveInput(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveInput(true)}
              >
                <Save className="h-4 w-4 mr-1" />
                Save As
              </Button>
            )}
          </div>

          <Textarea
            value={script}
            onChange={(e) => handleScriptChange(e.target.value)}
            className="font-mono text-sm min-h-[240px] bg-muted/50 border-border"
            spellCheck={false}
          />

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Output format:</span>
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="txt">TXT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleRunAndDownload}
            disabled={isRunning || !exportItem?.download_url}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRunning ? "Running..." : "Run & Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
