import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data, error } = await (supabase as any)
        .from('project_flags')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ProjectFlag[];
    },
    enabled: !!projectId,
  });

  const createFlag = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await (supabase as any)
        .from('project_flags')
        .insert({ project_id: projectId, name, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-flags', projectId] });
      toast.success('Flag created');
    },
    onError: (e) => toast.error(`Failed to create flag: ${e.message}`),
  });

  const deleteFlag = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await (supabase as any).from('project_flags').delete().eq('id', flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-flags', projectId] });
      toast.success('Flag deleted');
    },
    onError: (e) => toast.error(`Failed to delete flag: ${e.message}`),
  });

  const updateFlag = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await (supabase as any)
        .from('project_flags')
        .update({ name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-flags', projectId] });
      toast.success('Flag updated');
    },
    onError: (e) => toast.error(`Failed to update flag: ${e.message}`),
  });

  return { flags, isLoading, createFlag, deleteFlag, updateFlag };
}
