import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FolderOpen, FileJson, Package, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectApi } from "@/services/apiClient";

interface ImportAnnotationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
}

export function ImportAnnotationsDialog({
  open,
  onOpenChange,
  projects,
}: ImportAnnotationsDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [format, setFormat] = useState<"coco" | "yolo">("coco");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a target project");
      return;
    }
    if (!file) {
      toast.error("Please select an annotation file to upload");
      return;
    }

    // Get JWT token
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const storageKey = `sb-${projectId}-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      toast.error("Authentication required");
      return;
    }

    let token = "";
    try {
      token = JSON.parse(raw)?.access_token;
    } catch {
      toast.error("Authentication token could not be loaded");
      return;
    }

    setIsImporting(true);
    try {
      const result = await ProjectApi.import(selectedProjectId, format, file, token);
      if (result.success) {
        toast.success(`Successfully imported ${result.count} annotations`);
        onOpenChange(false);
        setFile(null);
      } else {
        toast.error("Import failed");
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Annotations
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Import bounding boxes, polygons, or points from COCO JSON or YOLO ZIP files directly into project files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project" className="text-sm font-medium">Target Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project" className="w-full bg-muted/30 border-border">
                <SelectValue placeholder="Select target project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" /> {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format" className="text-sm font-medium">Annotation Format</Label>
            <Select value={format} onValueChange={(v: "coco" | "yolo") => setFormat(v)}>
              <SelectTrigger id="format" className="w-full bg-muted/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coco">
                  <span className="flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-primary" /> COCO Format (JSON)
                  </span>
                </SelectItem>
                <SelectItem value="yolo">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" /> YOLO Format (ZIP)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload Zone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Annotation File</Label>
            <div className="border border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-6 bg-muted/10 flex flex-col items-center justify-center text-center cursor-pointer relative">
              <Input
                type="file"
                accept={format === "coco" ? ".json" : ".zip"}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-8 w-8 text-muted-foreground mb-2 opacity-60" />
              {file ? (
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="truncate max-w-[240px]">{file.name}</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Click to upload file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format === "coco" ? "Upload COCO JSON file" : "Upload ZIP with classes.txt and image txts"}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || !selectedProjectId || !file}
            className="bg-primary hover:bg-primary/95 text-primary-foreground font-medium"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              "Import Annotations"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
