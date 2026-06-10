import { useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadZone } from "@/components/UploadZone";
import { FileCard } from "@/components/FileCard";
import { useAuth } from "@/hooks/useAuth";
import { useFiles, FileRecord } from "@/hooks/useFiles";
import { useImportFiles } from "@/hooks/useImportFiles";
import { useDatasets, useDatasetFiles, useFileDatasetMap } from "@/hooks/useDatasets";
import { useProjects } from "@/hooks/useProjects";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate } from "react-router-dom";
import { CreateDatasetDialog } from "@/components/dataset/CreateDatasetDialog";
import { AddToDatasetDialog } from "@/components/dataset/AddToDatasetDialog";
import { DatasetPanel } from "@/components/dataset/DatasetPanel";
import { ImportFilesDialog } from "@/components/import/ImportFilesDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  LayoutGrid,
  List,
  Database,
  FolderOpen,
  FolderPlus,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

function PaginatedDataGrid({ files, viewMode, selectedFiles, onSelect, onDelete, onAddToDataset, fileDatasetMap }: {
  files: FileRecord[];
  viewMode: "grid" | "list";
  selectedFiles: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToDataset?: (id: string) => void;
  fileDatasetMap?: Record<string, string[]>;
}) {
  const { paginatedItems, currentPage, totalPages, totalItems, setCurrentPage } = usePagination(files, 12);
  return (
    <>
      <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4" : "space-y-3"}>
        {paginatedItems.map((file) => (
          <FileCard key={file.id} file={file} onSelect={() => onSelect(file.id)} onDelete={() => onDelete(file.id)} onAddToDataset={() => onAddToDataset?.(file.id)} isSelected={selectedFiles.has(file.id)} datasetNames={fileDatasetMap?.[file.id]} />
        ))}
      </div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} onPageChange={setCurrentPage} />
    </>
  );
}

export default function Data() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization(user?.id);
  const { files, isLoading, uploadFile, deleteFile } = useFiles(user?.id);
  const { datasets, isLoading: datasetsLoading, createDataset, deleteDataset, assignProject, addFiles, removeFile } = useDatasets(user?.id);
  const { projects } = useProjects(user?.id);
  const { data: fileDatasetMap = {} } = useFileDatasetMap(user?.id, datasets);
  const { importFiles } = useImportFiles(user?.id);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  // Single file → add to dataset dialog
  const [addToDatasetFileId, setAddToDatasetFileId] = useState<string | null>(null);
  // Bulk → add to dataset dialog
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  // Post-upload → add to dataset dialog
  const [postUploadFileIds, setPostUploadFileIds] = useState<string[] | null>(null);

  // Get file IDs in the selected dataset for filtering
  const { data: datasetFileIds = [] } = useDatasetFiles(selectedDatasetId ?? undefined);

  const handleFilesSelected = async (newFiles: File[]) => {
  if (!user) {
    toast.error("Sign in to upload files");
    navigate("/auth");
    return;
  }

  if (!newFiles || newFiles.length === 0) return;

  setIsUploading(true);

  try {
    const results = await Promise.all(
      newFiles.map(file =>
        uploadFile.mutateAsync({ file, userId: user.id })
      )
    );

    const uploadedIds = results
      .map(r => r?.id)
      .filter((id): id is string => Boolean(id));

    if (uploadedIds.length > 0 && datasets.length > 0) {
      setPostUploadFileIds(uploadedIds);
    }

  } catch (err) {
    console.error("Upload failed:", err);
    toast.error("Some files failed to upload");
  } finally {
    setIsUploading(false);
  }
};

  const handleSelectFile = (fileId: string) => {
    localStorage.setItem(
      "selectedFileId",
      fileId
    );
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) newSelected.delete(fileId);
    else newSelected.add(fileId);
    setSelectedFiles(newSelected);
  };

  const handleDeleteFile = (fileId: string) => {
    if (fileId.startsWith("demo-")) {
      toast.error("Cannot delete demo files");
      return;
    }
    deleteFile.mutate(fileId);
    const ns = new Set(selectedFiles);
    ns.delete(fileId);
    setSelectedFiles(ns);
  };

  const handleBulkDelete = () => {
    const toDelete = Array.from(selectedFiles).filter((id) => !id.startsWith("demo-"));
    toDelete.forEach((id) => deleteFile.mutate(id));
    setSelectedFiles(new Set());
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter === "all") { /* pass */ }
    else if (typeFilter === "image" && !f.type.startsWith("image")) return false;
    else if (typeFilter === "audio" && !f.type.startsWith("audio")) return false;
    else if (typeFilter === "video" && !f.type.startsWith("video")) return false;
    else if (typeFilter === "pdf" && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return false;
    else if (typeFilter === "text" && !f.type.startsWith("text") && !f.name.match(/\.(csv|tsv|xlsx|xls|json|xml|md|txt|log)$/i)) return false;

    // Dataset filter
    if (selectedDatasetId && datasetFileIds.length > 0) {
      if (!datasetFileIds.includes(f.id)) return false;
    } else if (selectedDatasetId && datasetFileIds.length === 0) {
      return false;
    }

    return true;
  });

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Data</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage project data files for annotation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search data..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary/50 border-transparent"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="text">Text / CSV</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Bulk selection toolbar */}
        {selectedFiles.size > 0 && (
          <div className="sticky top-[73px] z-10 border-b border-border bg-primary/5 backdrop-blur-sm px-8 py-2.5 flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""} selected
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSelectAll}>
              {selectedFiles.size === filteredFiles.length ? "Deselect all" : "Select all"}
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setBulkAddOpen(true)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Add to Datasets
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedFiles(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="p-8 flex gap-8">
          {/* Dataset sidebar */}
          <aside className="w-72 shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4" />
                Datasets
              </h2>
              <CreateDatasetDialog createDataset={createDataset} />
            </div>

            {selectedDatasetId && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setSelectedDatasetId(null)}
              >
                Show all files
              </Button>
            )}

            <DatasetPanel
              datasets={datasets}
              projects={projects}
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={setSelectedDatasetId}
              deleteDataset={deleteDataset}
              assignProject={assignProject}
              selectedFiles={selectedFiles}
              addFiles={addFiles}
            />
          </aside>

          {/* Main content */}
          <div className="flex-1 space-y-8 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <ImportFilesDialog
                datasets={datasets}
                onImport={async (entries, datasetIds) => {
                  if (!user) {
                    toast.error("Sign in to import files");
                    navigate("/auth");
                    return;
                  }
                  setIsImporting(true);
                  try {
                    const records = await importFiles.mutateAsync(entries);
                    // Assign to selected datasets
                    if (datasetIds.length > 0 && records?.length > 0) {
                      const fileIds = records.map((r: any) => r.id);
                      await Promise.all(
                        datasetIds.map((dsId) => addFiles.mutateAsync({ datasetId: dsId, fileIds }))
                      );
                    }
                  } finally {
                    setIsImporting(false);
                  }
                }}
                isImporting={isImporting}
              />
            </div>
            <UploadZone onFilesSelected={handleFilesSelected} isUploading={isUploading} />

            {isLoading ? (
              <div className="text-center py-20 text-muted-foreground">Loading data...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Database className="h-16 w-16 mx-auto opacity-30 mb-4" />
                <p className="text-lg font-medium">No data found</p>
                <p className="text-sm">
                  {selectedDatasetId ? "This dataset has no files yet. Select files and add them." : "Upload files to get started"}
                </p>
              </div>
            ) : (
              <PaginatedDataGrid
                files={filteredFiles}
                viewMode={viewMode}
                selectedFiles={selectedFiles}
                onSelect={handleSelectFile}
                onDelete={handleDeleteFile}
                onAddToDataset={(id) => setAddToDatasetFileId(id)}
                fileDatasetMap={fileDatasetMap}
              />
            )}
          </div>
        </div>

        {/* Single file → dataset dialog */}
        <AddToDatasetDialog
          open={!!addToDatasetFileId}
          onOpenChange={(v) => { if (!v) setAddToDatasetFileId(null); }}
          datasets={datasets}
          fileName={files.find((f) => f.id === addToDatasetFileId)?.name}
          isPending={addFiles.isPending}
          onConfirm={(datasetIds) => {
            if (!addToDatasetFileId) return;
            Promise.all(
              datasetIds.map((dsId) => addFiles.mutateAsync({ datasetId: dsId, fileIds: [addToDatasetFileId] }))
            ).then(() => setAddToDatasetFileId(null));
          }}
        />

        {/* Bulk → dataset dialog */}
        <AddToDatasetDialog
          open={bulkAddOpen}
          onOpenChange={setBulkAddOpen}
          datasets={datasets}
          fileCount={selectedFiles.size}
          isPending={addFiles.isPending}
          onConfirm={(datasetIds) => {
            const fileIds = Array.from(selectedFiles).filter((id) => !id.startsWith("demo-"));
            if (fileIds.length === 0) return;
            Promise.all(
              datasetIds.map((dsId) => addFiles.mutateAsync({ datasetId: dsId, fileIds }))
            ).then(() => {
              setBulkAddOpen(false);
              setSelectedFiles(new Set());
            });
          }}
        />

        {/* Post-upload → dataset dialog */}
        <AddToDatasetDialog
          open={!!postUploadFileIds}
          onOpenChange={(v) => { if (!v) setPostUploadFileIds(null); }}
          datasets={datasets}
          fileCount={postUploadFileIds?.length}
          isPending={addFiles.isPending}
          onConfirm={(datasetIds) => {
            if (!postUploadFileIds || postUploadFileIds.length === 0) return;
            Promise.all(
              datasetIds.map((dsId) => addFiles.mutateAsync({ datasetId: dsId, fileIds: postUploadFileIds }))
            ).then(() => setPostUploadFileIds(null));
          }}
        />
      </main>
    </div>
  );
}
