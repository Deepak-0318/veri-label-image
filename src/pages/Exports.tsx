import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useExports } from "@/hooks/useExports";
import { useFiles } from "@/hooks/useFiles";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Package,
  Calendar,
  FileText,
  Tags,
  FolderOpen,
  ClipboardList,
  Code,
  Upload,
} from "lucide-react";
import { TransformScriptDialog } from "@/components/export/TransformScriptDialog";
import { ImportAnnotationsDialog } from "@/components/import/ImportAnnotationsDialog";
import { ProjectApi } from "@/services/apiClient";
import { toast } from "sonner";

function PaginatedExportHistory({ exports, handleDownload, handleDelete, handleTransform, formatDate }: {
  exports: any[];
  handleDownload: (exp: any) => void;
  handleDelete: (id: string) => void;
  handleTransform: (exp: any) => void;
  formatDate: (d: string) => string;
}) {
  const { paginatedItems, currentPage, totalPages, totalItems, setCurrentPage } = usePagination(exports, 10);
  return (
    <>
      <div className="grid gap-4">
        {paginatedItems.map((exp) => {
          const nameMatch = exp.name.match(/^export_(.+)_\d{4}-\d{2}-\d{2}$/);
          const projectLabel = nameMatch ? nameMatch[1] : null;
          return (
            <Card key={exp.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {exp.format === "json" ? <FileJson className="h-5 w-5 text-primary" /> : <FileSpreadsheet className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{exp.name}.{exp.format === "json" ? "json" : "csv"}</p>
                      {projectLabel && projectLabel !== "all" && (
                        <Badge variant="secondary" className="text-[10px]"><FolderOpen className="h-3 w-3 mr-1" />{projectLabel}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(exp.created_at)}</span>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{exp.file_count} files</span>
                      <span className="flex items-center gap-1"><Tags className="h-3 w-3" />{exp.annotation_count} annotations</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(exp)}><Download className="h-4 w-4 mr-1" />Download</Button>
                  <Button variant="outline" size="sm" onClick={() => handleTransform(exp)}><Code className="h-4 w-4 mr-1" />Transform</Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} onPageChange={setCurrentPage} />
    </>
  );
}

export default function Exports() {
  const { user } = useAuth();
  const { organization } = useOrganization(user?.id);
  const { exports, isLoading, createExport, deleteExport } = useExports(user?.id);
  const { files } = useFiles(user?.id);
  const { projects } = useProjects(user?.id);
  const [exportFormat, setExportFormat] = useState("json");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [transformExport, setTransformExport] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { tasks: projectTasks } = useTasks(user?.id, selectedProjectId || undefined);

  const handleNewExport = async () => {
    if (!user) {
      toast.error("Sign in to create exports");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Please select a project to export");
      return;
    }

    let realFiles = files.filter((f) => !f.id.startsWith("demo-") && f.project_id === selectedProjectId);

    if (exportFormat === "coco" || exportFormat === "yolo") {
      setIsExporting(true);
      try {
        const projectIdEnv = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const storageKey = `sb-${projectIdEnv}-auth-token`;
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          toast.error("Authentication required");
          return;
        }
        const token = JSON.parse(raw)?.access_token;
        if (!token) {
          toast.error("Authentication token not found");
          return;
        }
        const downloadUrl = await ProjectApi.export(selectedProjectId, exportFormat, token);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `project_${selectedProjectId}_${exportFormat}.${exportFormat === "coco" ? "json" : "zip"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Register in exports history
        const selectedProject = projects.find((p) => p.id === selectedProjectId);
        const projectLabel = selectedProject?.name || "all";
        const name = `export_${projectLabel}_${new Date().toISOString().slice(0, 10)}`;
        await createExport.mutateAsync({
          name,
          format: exportFormat,
          fileCount: realFiles.length,
          annotationCount: 0,
          exportData: "Backend generated",
        });

        toast.success(`${exportFormat.toUpperCase()} export downloaded successfully`);
      } catch (err: any) {
        toast.error(`Export failed: ${err.message}`);
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // If a specific task is selected, filter to only that task's files
    if (selectedTaskId !== "all") {
      try {
        const { data: subTasks, error: stError } = await supabase
          .from("sub_tasks")
          .select("file_id")
          .eq("task_id", selectedTaskId);
        if (stError) throw stError;
        const taskFileIds = new Set((subTasks || []).map((st) => st.file_id));
        realFiles = realFiles.filter((f) => taskFileIds.has(f.id));
      } catch (err: any) {
        toast.error(`Failed to load task files: ${err.message}`);
        setIsExporting(false);
        return;
      }
    }

    if (realFiles.length === 0) {
      toast.error("No files to export for the selected filters.");
      return;
    }

    setIsExporting(true);
    try {
      const fileIds = realFiles.map((f) => f.id);
      const [annotationsRes, flagsRes] = await Promise.all([
        supabase
          .from("annotations")
          .select("*, label_type_rel:project_label_types(name), group_type_rel:project_group_types(name)")
          .in("file_id", fileIds)
          .range(0, 49999),
        (supabase as any)
          .from("annotation_flags")
          .select("annotation_id, flag:project_flags(name)")
          .range(0, 49999)
      ]);

      if (annotationsRes.error) throw annotationsRes.error;
      const annotations = annotationsRes.data || [];

      // Build a map of annotation_id -> flag names
      const flagsByAnnotation = new Map<string, string[]>();
      for (const af of (flagsRes.data || [])) {
        const flagName = (af as any).flag?.name;
        if (flagName) {
          const existing = flagsByAnnotation.get(af.annotation_id) || [];
          existing.push(flagName);
          flagsByAnnotation.set(af.annotation_id, existing);
        }
      }

      const selectedProject = projects.find((p) => p.id === selectedProjectId);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        project: { id: selectedProject?.id, name: selectedProject?.name },
        files: realFiles.map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          annotations: annotations
            .filter((a) => a.file_id === file.id)
            .map((a) => {
              const labelTypeRel = (a as any).label_type_rel;
              const groupTypeRel = (a as any).group_type_rel;
              return {
                label: a.label,
                type: a.type,
                color: a.color,
                data: a.data,
                label_type: labelTypeRel?.name || null,
                group_type: groupTypeRel?.name || "Default",
                comment: a.comment || "",
                flags: flagsByAnnotation.get(a.id) || [],
              };
            }),
        })),
      };

      let exportData: string;
      if (exportFormat === "json") {
        exportData = JSON.stringify(exportPayload, null, 2);
      } else {
        const rows = exportPayload.files.flatMap((file) =>
          file.annotations.length > 0
            ? file.annotations.map((ann) => ({
                project: selectedProject?.name || "All",
                file_name: file.name,
                file_type: file.type,
                label: ann.label,
                label_type: ann.label_type || "",
                group_type: ann.group_type || "Default",
                type: ann.type,
                color: ann.color,
                comment: ann.comment || "",
                flags: ann.flags.join("; "),
                data: JSON.stringify(ann.data),
              }))
            : [
                {
                  project: selectedProject?.name || "All",
                  file_name: file.name,
                  file_type: file.type,
                  label: "",
                  label_type: "",
                  group_type: "",
                  type: "",
                  color: "",
                  comment: "",
                  flags: "",
                  data: "",
                },
              ]
        );
        const headers = Object.keys(rows[0] || {}).join(",");
        const csvRows = rows.map((r) =>
          Object.values(r)
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );
        exportData = [headers, ...csvRows].join("\n");
      }

      const totalAnnotations = (annotations || []).length;
      const selectedTask = projectTasks.find((t) => t.id === selectedTaskId);
      const projectLabel = selectedProject?.name || "all";
      const taskLabel = selectedTask ? `_task-${selectedTask.name}` : "";
      const name = `export_${projectLabel}${taskLabel}_${new Date().toISOString().slice(0, 10)}`;

      await createExport.mutateAsync({
        name,
        format: exportFormat,
        fileCount: realFiles.length,
        annotationCount: totalAnnotations,
        exportData,
      });
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = (exp: { download_url: string | null; name: string; format: string }) => {
    if (!exp.download_url) {
      toast.error("Download URL not available");
      return;
    }
    const a = document.createElement("a");
    a.href = exp.download_url;
    a.download = `${exp.name}.${exp.format === "json" ? "json" : "csv"}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = (exportId: string) => {
    deleteExport.mutate(exportId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Exports</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Download and manage your annotation exports
              </p>
            </div>
            <Button onClick={() => setImportOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Annotations
            </Button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* New Export Card */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Create New Export
              </CardTitle>
              <CardDescription>
                Export files and annotations for a specific project, optionally filtered by task
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 flex-wrap">
                <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedTaskId("all"); }}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Select project" />
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
                {selectedProjectId && projectTasks.length > 0 && (
                  <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" /> All Tasks
                        </span>
                      </SelectItem>
                      {projectTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" /> {t.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <span className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" /> JSON
                      </span>
                    </SelectItem>
                    <SelectItem value="csv">
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" /> CSV
                      </span>
                    </SelectItem>
                    <SelectItem value="coco">
                      <span className="flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-primary" /> COCO JSON
                      </span>
                    </SelectItem>
                    <SelectItem value="yolo">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" /> YOLO ZIP
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleNewExport}
                  disabled={isExporting || !user || !selectedProjectId}
                  variant="default"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? "Exporting..." : "Export Now"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Export History */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Export History</h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : exports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">No exports yet</p>
                  <p className="text-sm mt-1">
                    Create your first export using the form above
                  </p>
                </CardContent>
              </Card>
            ) : (
              <PaginatedExportHistory exports={exports} handleDownload={handleDownload} handleDelete={handleDelete} handleTransform={(exp: any) => setTransformExport(exp)} formatDate={formatDate} />
            )}
          </div>
        </div>

        <TransformScriptDialog
          open={!!transformExport}
          onOpenChange={(open) => { if (!open) setTransformExport(null); }}
          exportItem={transformExport}
        />

        <ImportAnnotationsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          projects={projects}
        />
      </main>
    </div>
  );
}
