import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TagColor } from "@/types/annotation";
import { toast } from "sonner";

export interface ProjectLabelType {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectLabel {
  id: string;
  project_id: string;
  label_type_id: string;
  name: string;
  color: TagColor;
  created_by: string;
  created_at: string;
}

export function useProjectLabelTypes(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: labelTypes = [], isLoading } = useQuery({
    queryKey: ['project-label-types', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_label_types')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ProjectLabelType[];
    },
    enabled: !!projectId,
  });

  const createLabelType = useMutation({
    mutationFn: async ({ name, description, userId }: { name: string; description?: string; userId: string }) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('project_label_types')
        .insert({ project_id: projectId, name, description: description || null, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectLabelType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-label-types', projectId] });
      toast.success('Label type created');
    },
    onError: (error) => toast.error(`Failed to create label type: ${error.message}`),
  });

  const deleteLabelType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_label_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-label-types', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label type deleted');
    },
    onError: (error) => toast.error(`Failed to delete label type: ${error.message}`),
  });

  const updateLabelType = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase
        .from('project_label_types')
        .update({ name, description: description || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-label-types', projectId] });
      toast.success('Label type updated');
    },
    onError: (error) => toast.error(`Failed to update label type: ${error.message}`),
  });

  return { labelTypes, isLoading, createLabelType, deleteLabelType, updateLabelType };
}

export function useProjectLabels(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: projectLabels = [], isLoading } = useQuery({
    queryKey: ['project-labels', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_labels')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any[]).map(d => ({ ...d, color: d.color as TagColor })) as ProjectLabel[];
    },
    enabled: !!projectId,
  });

  const createLabel = useMutation({
    mutationFn: async ({ labelTypeId, name, color, userId }: { labelTypeId: string; name: string; color: string; userId: string }) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('project_labels')
        .insert({ project_id: projectId, label_type_id: labelTypeId, name, color, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label created');
    },
    onError: (error) => toast.error(`Failed to create label: ${error.message}`),
  });

  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('project_labels').delete().eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Permission denied: unable to delete this label');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label deleted');
    },
    onError: (error) => toast.error(`Failed to delete label: ${error.message}`),
  });

  const updateLabel = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from('project_labels')
        .update({ name, color })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label updated');
    },
    onError: (error) => toast.error(`Failed to update label: ${error.message}`),
  });

  return { projectLabels, isLoading, createLabel, deleteLabel, updateLabel };
}
