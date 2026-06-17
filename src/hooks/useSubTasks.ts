import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SubTask {
  id: string;
  task_id: string;
  file_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  file?: {
    id: string;
    name: string;
    type: string;
    size: number | null;
    thumbnail_url: string | null;
    content: string | null;
  };
}


async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  return session.access_token;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken();

  const baseUrl =
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

  const response = await fetch(
    `${baseUrl}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export function useSubTasks(taskId?: string) {
  const queryClient = useQueryClient();

  const {
    data: subTasks = [],
    isLoading,
    error,
  } = useQuery<SubTask[]>({
    queryKey: ["subtasks", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      return await apiFetch<SubTask[]>(
        `/api/tasks/${taskId}/subtasks`
      );
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: SubTask["status"];
    }) => {
      return await apiFetch<SubTask>(
        `/api/subtasks/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subtasks", taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });

      toast.success("Subtask updated");
    },

    onError: (e: Error) => {
      toast.error(`Failed: ${e.message}`);
    },
  });

  const deleteSubTask = useMutation({
    mutationFn: async (id: string) => {
      return await apiFetch<{ success: boolean }>(
        `/api/subtasks/${id}`,
        {
          method: "DELETE",
        }
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subtasks", taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });

      toast.success("Subtask deleted");
    },

    onError: (e: Error) => {
      toast.error(`Failed: ${e.message}`);
    },
  });

  return {
    subTasks,
    isLoading,
    error,
    updateStatus,
    deleteSubTask,
  };
}