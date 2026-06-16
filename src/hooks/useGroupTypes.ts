import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/services/api";

export interface GroupType {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export function useGroupTypes(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["group_types", projectId];

  const { data: groupTypes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiFetch(`/api/definitions?projectId=${projectId}&type=group_type`);
      const data = await res.json();
      return data as GroupType[];
    },
    enabled: !!projectId,
  });

  const createGroupType = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      if (!projectId) throw new Error("No project ID");
      const res = await apiFetch(`/api/definitions?type=group_type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name })
      });
      return await res.json() as GroupType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Group type created");
    },
    onError: (error: any) => {
      toast.error(`Failed to create group type: ${error.message}`);
    },
  });

  const deleteGroupType = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/definitions/${id}?type=group_type`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Group type deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete group type: ${error.message}`);
    },
  });

  const updateGroupType = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiFetch(`/api/definitions/${id}?type=group_type`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Group type updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update group type: ${error.message}`);
    },
  });

  return { groupTypes, isLoading, createGroupType, deleteGroupType, updateGroupType };
}

