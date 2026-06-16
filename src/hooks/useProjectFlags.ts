import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/services/api";

export interface ProjectFlag {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export function useProjectFlags(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['project-flags', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiFetch(`/api/definitions?projectId=${projectId}&type=flag`);
      const data = await res.json();
      return data as ProjectFlag[];
    },
    enabled: !!projectId,
  });

  const createFlag = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      if (!projectId) throw new Error('No project ID');
      const res = await apiFetch(`/api/definitions?type=flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name })
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-flags', projectId] });
      toast.success('Flag created');
    },
    onError: (e: Error) => toast.error(`Failed to create flag: ${e.message}`),
  });

  const deleteFlag = useMutation({
    mutationFn: async (flagId: string) => {
      await apiFetch(`/api/definitions/${flagId}?type=flag`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-flags', projectId] });
      toast.success('Flag deleted');
    },
    onError: (e: Error) => toast.error(`Failed to delete flag: ${e.message}`),
  });

  const updateFlag = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiFetch(`/api/definitions/${id}?type=flag`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-flags', projectId] });
      toast.success('Flag updated');
    },
    onError: (e: Error) => toast.error(`Failed to update flag: ${e.message}`),
  });

  return { flags, isLoading, createFlag, deleteFlag, updateFlag };
}

