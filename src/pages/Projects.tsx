import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, Project } from "@/hooks/useProjects";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FolderOpen, Pencil, Trash2, LogIn, Loader2, FileText, Image, Mic, Video, Database as DatabaseIcon, Bot, Copy, MoreVertical, Box } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

function ProjectGrid({ projects, navigate, openEditDialog, setDeleteConfirmId, onClone, canClone }: {
  projects: Project[];
  navigate: (path: string) => void;
  openEditDialog: (p: Project) => void;
  setDeleteConfirmId: (id: string) => void;
  onClone: (id: string) => void;
  canClone: boolean;
}) {
  const { paginatedItems, currentPage, totalPages, totalItems, setCurrentPage } = usePagination(projects, 12);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedItems.map((project) => (
          <Card
            key={project.id}
            className="group hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Created {format(new Date(project.created_at), "MMM d, yyyy")}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {canClone && (
                      <DropdownMenuItem onClick={() => onClone(project.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Clone
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => openEditDialog(project)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirmId(project.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {project.description || "No description"}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] capitalize">{project.data_type || "text"}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{(project.annotation_type || "classification").replace("_", " ")}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} onPageChange={setCurrentPage} />
    </>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { organization } = useOrganization(user?.id);
  const { projects, isLoading, createProject, updateProject, deleteProject, cloneProject } = useProjects(user?.id);
  const { isManager } = useUserRole(user?.id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") === "true") {
      setIsCreateOpen(true);
      navigate("/projects", { replace: true });
    }
  }, [location.search, navigate]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDataType, setFormDataType] = useState("text");
  const [formAnnotationType, setFormAnnotationType] = useState("classification");
  const [formGuidelines, setFormGuidelines] = useState("");

  const DATA_TYPES = [
    { value: "robotics", label: "Robotics Data", icon: Bot },
    { value: "text", label: "Text", icon: FileText },
    { value: "image", label: "Image", icon: Image },
    { value: "audio", label: "Audio", icon: Mic },
    { value: "video", label: "Video", icon: Video },
    { value: "pdf", label: "PDF / Document", icon: FileText },
    { value: "tabular", label: "Tabular / CSV", icon: DatabaseIcon },
    { value: "lidar", label: "LiDAR / Point Cloud", icon: Box },
  ];

  const LIDAR_ANNOTATION_TYPES = [
    { value: "3d_bounding_box", label: "3D Bounding Box", description: "Draw cuboids around objects in 3D space" },
  ];

  const ANNOTATION_TYPES = [
    { value: "classification", label: "Classification", description: "Assign one or more labels to each item" },
    { value: "ner", label: "Named Entity Recognition", description: "Tag spans of text with entity types" },
    { value: "bounding_box", label: "Bounding Box", description: "Draw rectangles around objects in images" },
    { value: "segmentation", label: "Segmentation", description: "Pixel-level or polygon masks" },
    { value: "transcription", label: "Transcription", description: "Transcribe audio/video to text" },
    { value: "sentiment", label: "Sentiment Analysis", description: "Classify sentiment (positive/negative/neutral)" },
    { value: "qa", label: "Question Answering", description: "Highlight answer spans in context" },
    { value: "custom", label: "Custom", description: "Define your own annotation schema" },
  ];

  const isLidar = formDataType === "lidar";
  useEffect(() => {
    if (isLidar && formAnnotationType !== "3d_bounding_box") {
      setFormAnnotationType("3d_bounding_box");
    }
  }, [isLidar, formAnnotationType]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormDataType("text");
    setFormAnnotationType("classification");
    setFormGuidelines("");
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    await createProject.mutateAsync({
      name: formName,
      description: formDescription,
      data_type: formDataType,
      annotation_type: formAnnotationType,
      guidelines: formGuidelines,
    });
    resetForm();
    setIsCreateOpen(false);
  };

  const handleEdit = async () => {
    if (!editingProject || !formName.trim()) return;
    await updateProject.mutateAsync({
      id: editingProject.id,
      name: formName,
      description: formDescription,
    });
    setEditingProject(null);
    setFormName("");
    setFormDescription("");
    setIsEditOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteProject.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormDescription(project.description || "");
    setIsEditOpen(true);
  };

  if (!user && !authLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to manage projects</h2>
            <p className="text-muted-foreground">Create and organize your annotation projects</p>
            <Button onClick={() => navigate("/auth")}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Organize your annotation work into projects
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                  <DialogDescription>
                    Set up your annotation project with the right configuration.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Project Name</label>
                    <Input
                      placeholder="e.g. Customer Support Sentiment Analysis"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Type</label>
                    <p className="text-xs text-muted-foreground">What kind of data will you annotate?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {DATA_TYPES.map((dt) => {
                        const Icon = dt.icon;
                        return (
                          <button
                            key={dt.value}
                            type="button"
                            onClick={() => setFormDataType(dt.value)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm transition-all ${
                              formDataType === dt.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs font-medium">{dt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Annotation Type</label>
                    <p className="text-xs text-muted-foreground">How should data be labeled?</p>
                    {isLidar ? (
                      <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2.5">
                        <div className="text-sm">
                          <span className="font-medium">3D Bounding Box</span>
                          <span className="text-muted-foreground ml-2 text-xs">— Draw cuboids around objects in 3D space</span>
                        </div>
                      </div>
                    ) : (
                      <Select value={formAnnotationType} onValueChange={setFormAnnotationType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ANNOTATION_TYPES.map((at) => (
                            <SelectItem key={at.value} value={at.value}>
                              <div>
                                <span className="font-medium">{at.label}</span>
                                <span className="text-muted-foreground ml-2 text-xs">— {at.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Brief overview of the project goals..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Annotation Guidelines</label>
                    <p className="text-xs text-muted-foreground">Instructions for annotators (optional)</p>
                    <Textarea
                      placeholder="e.g. Label each sentence as positive, negative, or neutral. When in doubt, choose neutral..."
                      value={formGuidelines}
                      onChange={(e) => setFormGuidelines(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!formName.trim() || createProject.isPending}>
                    {createProject.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Create Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
              <p className="text-muted-foreground mb-4">
                Create your first project to start organizing your annotations.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <ProjectGrid projects={projects} navigate={navigate} openEditDialog={openEditDialog} setDeleteConfirmId={setDeleteConfirmId} onClone={(id) => { toast.loading("Cloning project...", { id: "clone-project" }); cloneProject.mutate(id); }} canClone={isManager} />
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Project name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formName.trim() || updateProject.isPending}>
              {updateProject.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Files in this project will be unassigned but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
