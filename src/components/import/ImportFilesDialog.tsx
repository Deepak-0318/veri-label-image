import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Import, Link, Cloud, HardDrive, Plus, Loader2, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { S3Browser } from "./S3Browser";

interface Dataset {
  id: string;
  name: string;
}

interface ImportFilesDialogProps {
  onImport: (entries: ImportEntry[], datasetIds: string[]) => Promise<void>;
  isImporting?: boolean;
  datasets?: Dataset[];
}

export interface ImportEntry {
  name: string;
  url: string;
  type: string;
  size: number | null;
  copyToStorage: boolean;
}

function guessTypeFromUrl(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", pdf: "application/pdf", csv: "text/csv",
    json: "application/json", txt: "text/plain", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] || "application/octet-stream";
}

function guessNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").pop() || "imported-file";
    return decodeURIComponent(name);
  } catch {
    return "imported-file";
  }
}

export function ImportFilesDialog({ onImport, isImporting = false, datasets = [] }: ImportFilesDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("url");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<Set<string>>(new Set());

  const toggleDataset = (id: string) => {
    setSelectedDatasetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // URL import state
  const [urlEntries, setUrlEntries] = useState<Array<{ url: string; name: string; copyToStorage: boolean }>>([
    { url: "", name: "", copyToStorage: false },
  ]);

  // Bulk URL state
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkCopy, setBulkCopy] = useState(false);

  const addUrlEntry = () => {
    setUrlEntries([...urlEntries, { url: "", name: "", copyToStorage: false }]);
  };

  const removeUrlEntry = (idx: number) => {
    setUrlEntries(urlEntries.filter((_, i) => i !== idx));
  };

  const updateUrlEntry = (idx: number, field: string, value: string | boolean) => {
    const updated = [...urlEntries];
    updated[idx] = { ...updated[idx], [field]: value };
    setUrlEntries(updated);
  };

  const handleUrlImport = async () => {
    const valid = urlEntries.filter((e) => e.url.trim());
    if (valid.length === 0) {
      toast.error("Please enter at least one URL");
      return;
    }

    const entries: ImportEntry[] = valid.map((e) => ({
      name: e.name.trim() || guessNameFromUrl(e.url.trim()),
      url: e.url.trim(),
      type: guessTypeFromUrl(e.url.trim()),
      size: null,
      copyToStorage: e.copyToStorage,
    }));

    await onImport(entries, Array.from(selectedDatasetIds));
    setUrlEntries([{ url: "", name: "", copyToStorage: false }]);
    setOpen(false);
  };

  const handleBulkImport = async () => {
    const urls = bulkUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      toast.error("Please enter at least one URL");
      return;
    }

    const entries: ImportEntry[] = urls.map((url) => ({
      name: guessNameFromUrl(url),
      url,
      type: guessTypeFromUrl(url),
      size: null,
      copyToStorage: bulkCopy,
    }));

    await onImport(entries, Array.from(selectedDatasetIds));
    setBulkUrls("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Import className="h-4 w-4" />
          Import Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="h-5 w-5" />
            Import from External Source
          </DialogTitle>
        </DialogHeader>

        {/* Dataset selector */}
        {datasets.length > 0 && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Assign to Datasets (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {datasets.map((ds) => (
                <label
                  key={ds.id}
                  className="flex items-center gap-1.5 text-xs cursor-pointer rounded-md border border-border px-2 py-1.5 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedDatasetIds.has(ds.id)}
                    onCheckedChange={() => toggleDataset(ds.id)}
                  />
                  {ds.name}
                </label>
              ))}
            </div>
            {selectedDatasetIds.size > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Imported files will be added to {selectedDatasetIds.size} dataset{selectedDatasetIds.size !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url" className="gap-1.5">
              <Link className="h-3.5 w-3.5" />
              URL / Link
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              Bulk URLs
            </TabsTrigger>
            <TabsTrigger value="cloud" className="gap-1.5" disabled>
              <Cloud className="h-3.5 w-3.5" />
              Cloud Drives (Soon)
            </TabsTrigger>
          </TabsList>

          {/* Single URL entries */}
          <TabsContent value="url" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Add files by URL. You can choose to keep them as references or copy them to storage.
            </p>

            {urlEntries.map((entry, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">File {idx + 1}</span>
                  {urlEntries.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeUrlEntry(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">File URL</Label>
                  <Input
                    placeholder="https://example.com/file.pdf or s3://bucket/path"
                    value={entry.url}
                    onChange={(e) => updateUrlEntry(idx, "url", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Display Name (optional)</Label>
                  <Input
                    placeholder="Auto-detected from URL"
                    value={entry.name}
                    onChange={(e) => updateUrlEntry(idx, "name", e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={entry.copyToStorage}
                    onCheckedChange={(v) => updateUrlEntry(idx, "copyToStorage", v)}
                  />
                  <Label className="text-xs text-muted-foreground">
                    {entry.copyToStorage ? "Copy to storage" : "Reference only (no copy)"}
                  </Label>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="gap-1.5" onClick={addUrlEntry}>
              <Plus className="h-3.5 w-3.5" />
              Add another file
            </Button>

            <div className="flex justify-end pt-2">
              <Button onClick={handleUrlImport} disabled={isImporting} className="gap-2">
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
                Import {urlEntries.filter((e) => e.url.trim()).length} file(s)
              </Button>
            </div>
          </TabsContent>

          {/* Bulk URLs */}
          <TabsContent value="bulk" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Paste multiple URLs, one per line. All will use the same storage mode.
            </p>

            <div className="space-y-2">
              <Label className="text-xs">URLs (one per line)</Label>
              <Textarea
                placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.png\nhttps://drive.google.com/file/d/..."}
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                rows={8}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={bulkCopy} onCheckedChange={setBulkCopy} />
              <Label className="text-xs text-muted-foreground">
                {bulkCopy ? "Copy all to storage" : "Reference only (no copy)"}
              </Label>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleBulkImport} disabled={isImporting} className="gap-2">
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
                Import {bulkUrls.split("\n").filter((u) => u.trim()).length} file(s)
              </Button>
            </div>
          </TabsContent>

          {/* Cloud Drives - Coming Soon */}
          <TabsContent value="cloud" className="space-y-4 mt-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Cloud className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Cloud Drive Integrations</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                AWS S3, Google Drive, and OneDrive integrations are coming soon. Use URL or Bulk URL import for now.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
