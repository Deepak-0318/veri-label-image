import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Folder,
  FileIcon,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Import,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { ImportEntry } from "./ImportFilesDialog";

interface S3Object {
  key: string;
  name: string;
  size: number;
  lastModified: string;
}

interface S3Folder {
  prefix: string;
  name: string;
}

interface S3BrowserProps {
  onImport: (entries: ImportEntry[]) => Promise<void>;
  isImporting?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function guessTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", pdf: "application/pdf", csv: "text/csv",
    json: "application/json", txt: "text/plain", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    parquet: "application/octet-stream", mcap: "application/octet-stream",
  };
  return map[ext] || "application/octet-stream";
}

export function S3Browser({ onImport, isImporting = false }: S3BrowserProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [prefixHistory, setPrefixHistory] = useState<string[]>([]);
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [files, setFiles] = useState<S3Object[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [copyToStorage, setCopyToStorage] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [nextToken, setNextToken] = useState<string | null>(null);

  const browse = async (prefix: string, continuationToken?: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error: fnError } = await supabase.functions.invoke("s3-browse", {
        body: {
          action: "list",
          prefix: prefix || undefined,
          continuationToken: continuationToken || undefined,
        },
      });

      if (fnError) throw new Error(fnError.message || "Failed to browse S3");
      if (data.error) throw new Error(data.error);

      if (continuationToken) {
        // Append to existing results
        setFiles((prev) => [...prev, ...data.files]);
      } else {
        setFolders(data.folders || []);
        setFiles(data.files || []);
      }
      setIsTruncated(data.isTruncated || false);
      setNextToken(data.nextToken || null);
      setConnected(true);
      setCurrentPrefix(prefix);
    } catch (err: any) {
      console.error("S3 browse error:", err);
      setError(err.message || "Failed to connect to S3");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => browse("");

  const navigateToFolder = (prefix: string) => {
    setPrefixHistory((prev) => [...prev, currentPrefix]);
    setSelectedKeys(new Set());
    browse(prefix);
  };

  const goBack = () => {
    const prev = prefixHistory[prefixHistory.length - 1] ?? "";
    setPrefixHistory((h) => h.slice(0, -1));
    setSelectedKeys(new Set());
    browse(prev);
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedKeys.size === files.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(files.map((f) => f.key)));
    }
  };

  const handleImport = async () => {
    if (selectedKeys.size === 0) {
      toast.error("Select at least one file");
      return;
    }

    const entries: ImportEntry[] = [];

    for (const key of selectedKeys) {
      const file = files.find((f) => f.key === key);
      if (!file) continue;

      let url = `s3://${key}`;

      // Get a signed download URL for copy mode or as the reference URL
      try {
        const { data, error: fnError } = await supabase.functions.invoke("s3-browse", {
          body: { action: "sign_download", objectKey: key },
        });

        if (!fnError && data?.url) {
          url = data.url;
        }
      } catch {
        // Fall back to s3:// URI
      }

      entries.push({
        name: file.name,
        url,
        type: guessTypeFromKey(key),
        size: file.size,
        copyToStorage,
      });
    }

    await onImport(entries);
    setSelectedKeys(new Set());
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Connect to your AWS S3 bucket to browse and import files. The S3 connector must be configured in your workspace first.
        </p>
        <Button onClick={handleConnect} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
          Connect & Browse S3
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Breadcrumb / navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          disabled={prefixHistory.length === 0 && !currentPrefix}
          onClick={goBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="flex-1 text-xs text-muted-foreground font-mono truncate bg-secondary/50 px-2 py-1 rounded">
          s3://{currentPrefix || "/"}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => browse(currentPrefix)}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* File list */}
      <ScrollArea className="h-[300px] rounded-lg border border-border">
        {loading && folders.length === 0 && files.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileIcon className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No files in this location</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Folders */}
            {folders.map((folder) => (
              <button
                key={folder.prefix}
                onClick={() => navigateToFolder(folder.prefix)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
              >
                <Folder className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{folder.name}/</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
              </button>
            ))}

            {/* Files */}
            {files.map((file) => (
              <label
                key={file.key}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={selectedKeys.has(file.key)}
                  onCheckedChange={() => toggleSelect(file.key)}
                />
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(file.size)}
                </span>
              </label>
            ))}

            {/* Load more */}
            {isTruncated && (
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => browse(currentPrefix, nextToken)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Load more...
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
            {selectedKeys.size === files.length && files.length > 0 ? "Deselect all" : "Select all"}
          </Button>
          {selectedKeys.size > 0 && (
            <span className="text-xs text-muted-foreground">{selectedKeys.size} selected</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={copyToStorage} onCheckedChange={setCopyToStorage} />
            <Label className="text-xs text-muted-foreground">
              {copyToStorage ? "Copy to storage" : "Reference only"}
            </Label>
          </div>
          <Button
            onClick={handleImport}
            disabled={selectedKeys.size === 0 || isImporting}
            size="sm"
            className="gap-1.5"
          >
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Import className="h-3.5 w-3.5" />}
            Import {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
