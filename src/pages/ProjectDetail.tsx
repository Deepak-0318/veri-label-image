import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { UploadZone } from "@/components/UploadZone";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { useUserRole } from "@/hooks/useUserRole";
import { useTasks } from "@/hooks/useTasks";
import { FileCard } from "@/components/FileCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  FolderOpen,
  Loader2,
  LogIn,
  FileText,
  Image,
  Video,
  Tag,
  BookOpen,
  Pencil,
  Settings,
  Layers,
  Database,
  Workflow,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ProjectPipelineRunner } from "@/components/project/ProjectPipelineRunner";
import { ProjectLabelManager } from "@/components/project/ProjectLabelManager";
import { ProjectGroupTypeManager } from "@/components/project/ProjectGroupTypeManager";
import { ProjectFlagManager } from "@/components/project/ProjectFlagManager";
import { ProjectVariableManager } from "@/components/project/ProjectVariableManager";
import { apiFetch } from "@/services/api";

const getToken = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageKey = `sb-${projectId}-auth-token`;

  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw)?.access_token;
  } catch {
    return null;
  }
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { organization } = useOrganization(user?.id);
  const { projects, isLoading: projectsLoading } = useProjects(user?.id);
  const { files, annotationCounts, isLoading: filesLoading, refetch: refetchFiles } = useProjectFiles(projectId);
  const { isAdmin, isManager } = useUserRole(user?.id);
  const { tasks } = useTasks(user?.id, projectId);
  const canEdit = isAdmin || isManager;

  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("guidelines");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDataType, setEditDataType] = useState("");
  const [editAnnotationType, setEditAnnotationType] = useState("");
  const [editGuidelines, setEditGuidelines] = useState("");

  const project = projects.find((p) => p.id === projectId);
  const isLoading = projectsLoading || filesLoading || authLoading;

  // Stats
  const totalAnnotations = Object.values(annotationCounts).reduce((a, b) => a + b, 0);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const openEditDialog = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditDataType(project.data_type || "text");
    setEditAnnotationType(project.annotation_type || "classification");
    setEditGuidelines(project.guidelines || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!project) return;
    const { error } = await supabase
      .from('projects')
      .update({
        name: editName,
        description: editDescription || null,
        data_type: editDataType,
        annotation_type: editAnnotationType,
        guidelines: editGuidelines || null,
      })
      .eq('id', project.id);
    if (error) {
      toast.error(`Failed to update: ${error.message}`);
      return;
    }
    toast.success("Project updated");
    setEditDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['projects', user?.id] });
  };

 const handleFilesSelected = async (newFiles: File[]) => {
  if (!user || !projectId) return;

  setIsUploading(true);

  try {
    const token = getToken();

    for (const file of newFiles) {
      // 🔹 KEEP your content extraction logic
      let content: string | null = null;

      const textExts = ['.txt', '.csv', '.json', '.xml', '.md', '.log', '.tsv'];
      const excelExts = ['.xlsx', '.xls'];
      const lowerName = file.name.toLowerCase();

      if (file.type.startsWith('text/') || textExts.some(ext => lowerName.endsWith(ext))) {
        content = await file.text();
      } else if (excelExts.some(ext => lowerName.endsWith(ext))) {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        content = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("content", content || "");

      const res = await apiFetch(`/api/files/upload?projectId=${projectId}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
    }

    toast.success('Files uploaded successfully');
    refetchFiles();

  } catch (error: any) {
    toast.error(`Upload failed: ${error.message}`);
  } finally {
    setIsUploading(false);
  }
};

const handleDeleteFile = async (fileId: string) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const storageKey = `sb-${projectId}-auth-token`;

    const raw = localStorage.getItem(storageKey);
    const token = raw ? JSON.parse(raw)?.access_token : null;

    if (!token) {
      throw new Error("Not authenticated");
    }
    const res = await apiFetch(`/api/files/${fileId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }
    toast.success('File deleted');
    refetchFiles();

  } catch (error: any) {
    toast.error(`Failed to delete: ${error.message}`);
  }
};
  if (!user && !authLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view projects</h2>
            <p className="text-muted-foreground">Access your annotation projects</p>
            <Button onClick={() => navigate("/auth")}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Project not found</h2>
            <p className="text-muted-foreground">
              This project may have been deleted or you don't have access.
            </p>
            <Button onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/projects")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold truncate">{project.name}</h1>
                <Badge variant="secondary" className="text-[10px] capitalize">{project.data_type || "text"}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{(project.annotation_type || "classification").replace("_", " ")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Created {format(new Date(project.created_at), "MMMM d, yyyy")}
              </p>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Settings className="h-4 w-4 mr-1" />
                Edit Project
              </Button>
            )}
          </div>
          {project.description && (
            <p className="text-muted-foreground ml-12">{project.description}</p>
          )}
        </header>

        <div className="p-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{files.length}</p>
                  <p className="text-xs text-muted-foreground">Total Files</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Tag className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAnnotations}</p>
                  <p className="text-xs text-muted-foreground">Annotations</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalTasks}</p>
                  <p className="text-xs text-muted-foreground">Total Tasks</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completionPercent}%</p>
                  <p className="text-xs text-muted-foreground">Tasks Complete</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 h-11">
              <TabsTrigger value="guidelines" className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Guidelines</span>
              </TabsTrigger>
              <TabsTrigger value="definitions" className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Definitions</span>
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Data</span>
              </TabsTrigger>
              <TabsTrigger value="pipelines" className="flex items-center gap-2 text-sm">
                <Workflow className="h-4 w-4" />
                <span className="hidden sm:inline">Pipelines</span>
              </TabsTrigger>
            </TabsList>

            {/* Guidelines Tab */}
            <TabsContent value="guidelines" className="space-y-4">
              <div className="rounded-xl border bg-card">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Annotation Guidelines</h2>
                      <p className="text-xs text-muted-foreground">
                        Instructions for annotators working on this project
                      </p>
                    </div>
                  </div>
                  {project.guidelines ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 [&_*]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground [&_a]:text-primary [&_strong]:text-foreground [&_code]:text-foreground [&_li]:text-foreground">
                      <ReactMarkdown>{project.guidelines}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed rounded-lg">
                      <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No annotation guidelines have been provided for this project.
                      </p>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={openEditDialog}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Add Guidelines
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Definitions Tab */}
            <TabsContent value="definitions" className="space-y-6">
              {user && (
                <>
                  <div className="rounded-xl border bg-card p-6">
                    <ProjectLabelManager projectId={projectId!} userId={user.id} />
                  </div>
                  <div className="rounded-xl border bg-card p-6">
                    <ProjectGroupTypeManager projectId={projectId!} userId={user.id} />
                  </div>
                  <div className="rounded-xl border bg-card p-6">
                    <ProjectFlagManager projectId={projectId!} userId={user.id} />
                  </div>
                  {canEdit && (
                    <div className="rounded-xl border bg-card p-6">
                      <ProjectVariableManager projectId={projectId!} userId={user.id} />
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Data Tab */}
            <TabsContent value="data" className="space-y-6">
              <UploadZone onFilesSelected={handleFilesSelected} isUploading={isUploading} />

              <div>
                <h2 className="text-lg font-semibold mb-4">Files ({files.length})</h2>
                {files.length === 0 ? (
                  <div className="text-center py-12 border rounded-xl bg-card">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">No files in this project yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the upload zone above to add files to this project.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {files.map((file) => (
                      <div key={file.id} className="relative group">
                        <FileCard file={file} projectId={projectId} onDelete={() => handleDeleteFile(file.id)} />
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {annotationCounts[file.id] > 0 && (
                              <Badge variant="secondary" className="bg-primary/90 text-primary-foreground text-xs">
                                {annotationCounts[file.id]} annotations
                              </Badge>
                            )}
                          </div>
                        </div>
                        {annotationCounts[file.id] > 0 && (
                          <Badge
                            variant="secondary"
                            className="absolute top-2 left-2 bg-primary text-primary-foreground"
                          >
                            {annotationCounts[file.id]} annotations
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Pipelines Tab */}
            <TabsContent value="pipelines" className="space-y-6">
              {user && (
                <ProjectPipelineRunner
                  projectId={projectId!}
                  userId={user.id}
                  files={files}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Project
            </DialogTitle>
            <DialogDescription>Update project settings and annotation guidelines.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Type</label>
                <Select value={editDataType} onValueChange={setEditDataType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="robotics">Robotics Data</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="pdf">PDF / Document</SelectItem>
                    <SelectItem value="tabular">Tabular / CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Annotation Type</label>
                <Select value={editAnnotationType} onValueChange={setEditAnnotationType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">Classification</SelectItem>
                    <SelectItem value="ner">Named Entity Recognition</SelectItem>
                    <SelectItem value="bounding_box">Bounding Box</SelectItem>
                    <SelectItem value="segmentation">Segmentation</SelectItem>
                    <SelectItem value="transcription">Transcription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Annotation Guidelines</label>
              <p className="text-xs text-muted-foreground">Provide instructions for annotators working on this project.</p>
              <Textarea
                value={editGuidelines}
                onChange={(e) => setEditGuidelines(e.target.value)}
                rows={8}
                placeholder="Enter detailed annotation guidelines here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
