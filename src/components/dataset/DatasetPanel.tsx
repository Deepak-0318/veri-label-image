import { useState } from "react";
import { Dataset } from "@/hooks/useDatasets";
import { Project } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, FolderOpen, Plus, ChevronRight } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  datasets: Dataset[];
  projects: Project[];
  selectedDatasetId: string | null;
  onSelectDataset: (id: string | null) => void;
  deleteDataset: UseMutationResult<void, Error, string>;
  assignProject: UseMutationResult<any, Error, { datasetId: string; projectId: string | null }>;
  selectedFiles: Set<string>;
  addFiles: UseMutationResult<void, Error, { datasetId: string; fileIds: string[] }>;
}

export function DatasetPanel({
  datasets,
  projects,
  selectedDatasetId,
  onSelectDataset,
  deleteDataset,
  assignProject,
  selectedFiles,
  addFiles,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAddSelectedFiles = (datasetId: string) => {
    const fileIds = Array.from(selectedFiles).filter((id) => !id.startsWith("demo-"));
    if (fileIds.length === 0) return;
    addFiles.mutate({ datasetId, fileIds });
  };

  if (datasets.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
        No datasets yet. Create one to organize your files.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {datasets.map((ds) => {
        const isExpanded = expandedId === ds.id;
        const isActive = selectedDatasetId === ds.id;
        const project = projects.find((p) => p.id === ds.project_id);

        return (
          <div key={ds.id} className="border border-border rounded-lg overflow-hidden">
            <button
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/50 ${isActive ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
              onClick={() => {
                onSelectDataset(isActive ? null : ds.id);
                setExpandedId(isExpanded ? null : ds.id);
              }}
            >
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              <span className="font-medium truncate flex-1">{ds.name}</span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {ds.file_count ?? 0} files
              </Badge>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 pt-1 space-y-3 bg-secondary/20">
                {ds.description && (
                  <p className="text-xs text-muted-foreground">{ds.description}</p>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Assign to Project</label>
                  <Select
                    value={ds.project_id || "none"}
                    onValueChange={(v) =>
                      assignProject.mutate({ datasetId: ds.id, projectId: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {project && (
                  <Badge variant="outline" className="text-xs">
                    <FolderOpen className="h-3 w-3 mr-1" />
                    {project.name}
                  </Badge>
                )}

                <div className="flex items-center gap-2">
                  {selectedFiles.size > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleAddSelectedFiles(ds.id)}
                      disabled={addFiles.isPending}
                    >
                      <Plus className="h-3 w-3" />
                      Add {selectedFiles.size} selected
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive ml-auto">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete dataset "{ds.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the dataset grouping. The files themselves will not be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                          deleteDataset.mutate(ds.id);
                          if (selectedDatasetId === ds.id) onSelectDataset(null);
                        }}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
