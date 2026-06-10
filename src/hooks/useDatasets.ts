import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/services/api";

export interface Dataset {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  file_count?: number;
}

export interface DatasetFile {
  id: string;
  dataset_id: string;
  file_id: string;
  created_at: string;
}

const API = "/api/DatasetManagement";

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


async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getToken();

  return apiFetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
    },
  }).then(res => {
    if (!res.ok) throw new Error("API error");
    return res.json();
  });
}

export function useDatasets(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: datasets = [], isLoading } = useQuery({
        queryKey: ["datasets", userId],
    queryFn: async () => {
       if (!userId) return [];
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get file counts
      const counts: Record<string, number> = {};
      if (data.length > 0) {
        const { data: dfData } = await supabase
          .from("dataset_files")
          .select("dataset_id")
          .in("dataset_id", data.map((d: any) => d.id));
        if (dfData) {
          for (const row of dfData) {
            counts[row.dataset_id] = (counts[row.dataset_id] || 0) + 1;
          }
        }
      }

      return data.map((d: any) => ({ ...d, file_count: counts[d.id] || 0 })) as Dataset[];
    },
    enabled: !!userId,
  });

  const createDataset = useMutation({
    mutationFn: async ({ name, description }: CreateDatasetInput) => {
      return fetchWithAuth(API, {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
    },
  });


  const deleteDataset = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithAuth(`${API}/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
  });

const assignProject = useMutation({
  mutationFn: async ({ datasetId, projectId }: AssignProjectInput) => {
    return fetchWithAuth(`${API}/${datasetId}/assign-project`, {
      method: "PUT",
      body: JSON.stringify({ projectId }),
    });
  },
});

const addFiles = useMutation({
  mutationFn: async ({ datasetId, fileIds }: AddFilesInput) => {
    return fetchWithAuth(`${API}/${datasetId}/files`, {
      method: "POST",
      body: JSON.stringify({ fileIds }),
    });
  },
});


const removeFile = useMutation({
  mutationFn: async ({ datasetId, fileId }: RemoveFileInput) => {
    return fetchWithAuth(`${API}/${datasetId}/files/${fileId}`, {
      method: "DELETE",
    });
  },
});

  return {
    datasets,
    isLoading,
    createDataset,
    deleteDataset,
    assignProject,
    addFiles,
    removeFile,
  };
}

type CreateDatasetInput = {
  name: string;
  description?: string;
};

type AssignProjectInput = {
  datasetId: string;
  projectId: string | null;
};

type AddFilesInput = {
  datasetId: string;
  fileIds: string[];
};

type RemoveFileInput = {
  datasetId: string;
  fileId: string;
};


export function useDatasetFiles(datasetId: string | undefined) {
  return useQuery({
    queryKey: ["dataset_files", datasetId],
    queryFn: async () => {
      if (!datasetId) return [];

      return fetchWithAuth(`/api/DatasetManagement/${datasetId}/files`);
    },
    enabled: !!datasetId,
  });
}

export function useFileDatasetMap(
  userId: string | undefined,
  datasets: Dataset[]
) {
  return useQuery({
    queryKey: ["file_dataset_map", userId],
    queryFn: async () => {
      if (!userId || datasets.length === 0) return {};

      const datasetIds = datasets.map((d) => d.id);

      return fetchWithAuth(`/api/DatasetManagement/file-map`, {
        method: "POST",
        body: JSON.stringify({ datasetIds }),
      });
    },
    enabled: !!userId && datasets.length > 0,
  });
}
