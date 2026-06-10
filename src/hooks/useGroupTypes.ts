import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data, error } = await supabase
        .from("project_group_types" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as GroupType[];
    },
    enabled: !!projectId,
  });

  const createGroupType = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      if (!projectId) throw new Error("No project ID");
      const { data, error } = await supabase
        .from("project_group_types" as any)
        .insert({ project_id: projectId, name, created_by: userId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as GroupType;
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
      const { error } = await supabase
        .from("project_group_types" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
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
      const { error } = await supabase
        .from("project_group_types" as any)
        .update({ name } as any)
        .eq("id", id);
      if (error) throw error;
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
