import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileRecord } from "./useFiles";
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

export function useProjectFiles(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = getToken();

      const res = await apiFetch(`/api/files/get-files-by-project-id?projectId=${projectId}`, {
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch files");
      }

      const data = await res.json();

      const directFiles = data.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        thumbnail_url: f.sasUrl || null,
        content: f.content || null,
        project_id: projectId,
        folder: f.folder ?? null,
        external_url: null,
        storage_mode: "copy",
        created_at: f.createdAt,
        updated_at: f.createdAt,
      }));

      const supRes = await apiFetch(`/api/DatasetManagement/get-datasets-by-project/${projectId}` );

      if (!supRes.ok) {
        const err = await supRes.json();
        throw new Error(err.error || "Failed to fetch datasets");
      }

      const datasets = await supRes.json(); 

      let datasetFiles: FileRecord[] = [];
      if (datasets && datasets.length > 0) {
        const datasetIds = datasets;

        const fileRes = await apiFetch(`/api/DatasetManagement/get-files-by-dataset-ids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          datasetIds,
        }),
      });

        if (!fileRes.ok) {
          const err = await fileRes.json();
          console.warn(err.error || "Failed to fetch dataset files");
        }

        const dfRows = await fileRes.json(); 

        if (dfRows && dfRows.length > 0) {
          const directFileIds = new Set((directFiles || []).map(f => f.id));
          const extraFileIds = dfRows
            .filter(id => !directFileIds.has(id));

          if (extraFileIds.length > 0) {
            const token = getToken();

            const res = await apiFetch('/api/files/by-ids', {
              method: 'GET',
              body: JSON.stringify({ ids: extraFileIds }),
            });

            if (res.ok) {
              const data = await res.json();

              datasetFiles = data.map((f: any) => ({
                id: f.id,
                name: f.name,
                type: f.type,
                size: f.size,
                thumbnail_url: f.sasUrl || null,
                content: f.content || null,
                project_id: f.projectId ?? null,
                folder: f.folder ?? null,
                external_url: null,
                storage_mode: "copy",
                created_at: f.createdAt,
                updated_at: f.createdAt,
              }));
            }
          }
        }
      }

      // Merge and deduplicate
      const allFiles = [...(directFiles as FileRecord[]), ...datasetFiles];
      const seen = new Set<string>();
      return allFiles.filter(f => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
    },
    enabled: !!projectId,
  });

const { data: annotationCounts = {}, isLoading: annotationsLoading } = useQuery({
  queryKey: ['project-annotation-counts', projectId, files.map(f => f.id)],
  queryFn: async () => {
    if (!files.length) return {};

    const fileIds = files.map(f => f.id);
     let query = supabase
        .from('annotations')
        .select('file_id')
        .in('file_id', fileIds);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query.range(0, 49999);

      if (error) throw error;

      // Count annotations per file
      const counts: Record<string, number> = {};
      fileIds.forEach(id => counts[id] = 0);
      data.forEach(row => {
        counts[row.file_id] = (counts[row.file_id] || 0) + 1;
      });
    return counts;
  },
  enabled: files.length > 0,
});
  return {
    files,
    annotationCounts,
    isLoading: filesLoading || annotationsLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  };
}
