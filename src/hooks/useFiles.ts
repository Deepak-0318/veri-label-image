import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logActivityEvent } from "@/services/activityLogger";
import { logAuditEvent } from "@/services/auditLogger";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import { apiFetch } from "@/services/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface FileRecord {
  id: string;
  name: string;
  type: string;
  size: number | null;
  thumbnail_url: string | null;
  content: string | null;
  project_id: string | null;
  folder: string | null;
  external_url: string | null;
  storage_mode: string;
  created_at: string;
  updated_at: string;
}

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

const mapFile = (f: any): FileRecord => ({
  id: f.id,
  name: f.name,
  type: f.type,
  size: f.size,
  thumbnail_url: f.sasUrl || null,
  content: null,
  project_id: null,
  folder: null,
  external_url: null,
  storage_mode: "copy",
  created_at: f.createdAt,
  updated_at: f.createdAt,
});

export function useFiles(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
  queryKey: ['files', userId],
  queryFn: async () => {
    if (!userId) return [];

    const token = getToken();

    const res = await apiFetch('/api/files');

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to fetch files");
    }

    const data = await res.json();

    return data.map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      thumbnail_url: f.sasUrl || null,
      content: null,
      project_id: f.projectId,
      folder: null,
      external_url: null,
      storage_mode: "copy",
      created_at: f.createdAt,
      updated_at: f.createdAt,
    }));
  },
  enabled: !!userId,
});

  // Extract unique folder names from files
  const folders = Array.from(
    new Set(files.map(f => f.folder).filter((f): f is string => f !== null && f !== ""))
  ).sort();

  const uploadFile = useMutation({
    mutationFn: async ({ file, userId: uid, folder }: { file: File; userId: string; folder?: string | null;
 }) => {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${uid}/${timestamp}_${safeName}`;

      const token = getToken();

      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch(`/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();

      let content: string | null = null;
      const textExtensions = ['.txt', '.csv', '.json', '.xml', '.md', '.log', '.tsv'];
      const excelExtensions = ['.xlsx', '.xls'];
      const lowerName = file.name.toLowerCase();
      const isTextType = file.type.startsWith('text/') || textExtensions.some(ext => lowerName.endsWith(ext));
      const isExcelType = excelExtensions.some(ext => lowerName.endsWith(ext));
      const isPdfType = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
      
      if (isTextType) {
        content = await file.text();
      } else if (isExcelType) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        content = XLSX.utils.sheet_to_csv(firstSheet);
      } else if (isPdfType) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const textParts: string[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            if (pageText.trim()) textParts.push(pageText);
          }
          content = textParts.join('\n\n') || null;
        } catch (e) {
          console.warn('PDF text extraction failed:', e);
        }
      }

      return {
        id: data.id,
        name: data.name,
        type: data.type,
        size: data.size,
        thumbnail_url: data.sasUrl || null,
        content: null,
        project_id: null,
        folder: null,
        external_url: null,
        storage_mode: "copy",
        created_at: data.createdAt,
        updated_at: data.createdAt,
      };
    },
    onSuccess: (fileRecord) => {
      queryClient.invalidateQueries({ queryKey: ['files', userId] });
      toast.success('File uploaded successfully');
      if (userId) {
        logActivityEvent({
          userId,
          eventType: "upload",
          entityType: "file",
          entityId: fileRecord.id,
          description: `Uploaded "${fileRecord.name}"`,
        });
        logAuditEvent({
          userId,
          action: "upload_file",
          category: "crud",
          entityType: "file",
          entityId: fileRecord.id,
          entityName: fileRecord.name,
          description: `uploaded file "${fileRecord.name}"`,
          newValues: { name: fileRecord.name, type: fileRecord.type, size: fileRecord.size },
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to upload file: ${error.message}`);
    },
  });

  const deleteFile = useMutation({
  mutationFn: async (fileId: string) => {
    const token = getToken();

    const res = await apiFetch(`/api/files/${fileId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }

    return fileId;
  },

  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['files', userId] });
    toast.success('File deleted');
  },

  onError: (error) => {
    toast.error(`Failed to delete file: ${error.message}`);
  },
});

  const moveFiles = useMutation({
  mutationFn: async ({ fileIds, folder }: { fileIds: string[]; folder: string | null }) => {
    const token = getToken();

      const res = await apiFetch('/api/files/move', {
        method: 'PUT',
        body: JSON.stringify({ fileIds, folder }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Move failed");
      }
    },

    onSuccess: (_, { folder }) => {
      queryClient.invalidateQueries({ queryKey: ['files', userId] });
      toast.success(folder ? `Moved to "${folder}"` : 'Moved to root');
    },

    onError: (error) => {
      toast.error(`Failed to move files: ${error.message}`);
    },
  });

  const renameFolder = useMutation({
      mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
        const token = getToken();

        const res = await apiFetch('/api/files/rename-folder', {
          method: 'PUT',
          body: JSON.stringify({ oldName, newName }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Rename failed");
        }
      },

      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['files', userId] });
        toast.success('Folder renamed');
      },

      onError: (error) => {
        toast.error(`Failed to rename folder: ${error.message}`);
      },
    });

  return {
    files,
    folders,
    isLoading,
    uploadFile,
    deleteFile,
    moveFiles,
    renameFolder,
  };
}
