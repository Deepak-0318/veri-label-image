import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivityEvent } from "@/services/activityLogger";
import type { ImportEntry } from "@/components/import/ImportFilesDialog";
import { apiFetch } from "@/services/api";

export function useImportFiles(userId: string | undefined) {
  const queryClient = useQueryClient();

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

  const importFiles = useMutation({
    mutationFn: async (entries: ImportEntry[]) => {
  if (!userId) throw new Error("Not authenticated");

  const token = getToken();
  const results = [];

  for (const entry of entries) {
    const res = await apiFetch('/api/files/import', {
      method: 'POST',
      body: JSON.stringify({
        url: entry.url,
        name: entry.name,
        type: entry.type,
        size: entry.size,
        copyToStorage: entry.copyToStorage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Import failed");
    }

    const data = await res.json();

    results.push({
      id: data.id,
      name: data.name,
      type: data.type,
      size: data.size,
      thumbnail_url: data.sasUrl || null,
      content: null,
      project_id: null,
      folder: null,
      external_url: entry.url,
      storage_mode: data.storageMode,
      created_at: data.createdAt,
      updated_at: data.createdAt,
    });
  }

  return results;
},
    onSuccess: (records) => {
      queryClient.invalidateQueries({ queryKey: ["files", userId] });
      toast.success(`Imported ${records.length} file(s) successfully`);
      if (userId) {
        for (const r of records) {
          logActivityEvent({
            userId,
            eventType: "import",
            entityType: "file",
            entityId: r.id,
            description: `Imported "${r.name}" (${r.storage_mode})`,
          });
        }
      }
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  return { importFiles };
}
