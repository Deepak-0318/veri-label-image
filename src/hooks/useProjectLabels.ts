import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TagColor } from "@/types/annotation";
import { toast } from "sonner";
import { apiFetch } from "@/services/api";

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
      const res = await apiFetch(`/api/definitions?projectId=${projectId}&type=label_type`);
      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error("Definitions API returned:", data);
        return [];
      }
      return data as ProjectLabelType[];
    },
    enabled: !!projectId,
  });

  const createLabelType = useMutation({
    mutationFn: async ({ name, description, userId }: { name: string; description?: string; userId: string }) => {
      if (!projectId) throw new Error('No project ID');
      const res = await apiFetch(`/api/definitions?type=label_type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name, description: description || null })
      });
      return await res.json() as ProjectLabelType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-label-types', projectId] });
      toast.success('Label type created');
    },
    onError: (error: any) => toast.error(`Failed to create label type: ${error.message}`),
  });

  const deleteLabelType = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/definitions/${id}?type=label_type`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-label-types', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label type deleted');
    },
    onError: (error: any) => toast.error(`Failed to delete label type: ${error.message}`),
  });

  const updateLabelType = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      await apiFetch(`/api/definitions/${id}?type=label_type`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-label-types', projectId] });
      toast.success('Label type updated');
    },
    onError: (error: any) => toast.error(`Failed to update label type: ${error.message}`),
  });

  return { labelTypes, isLoading, createLabelType, deleteLabelType, updateLabelType };
}

export function useProjectLabels(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: projectLabels = [], isLoading } = useQuery({
    queryKey: ['project-labels', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiFetch(`/api/definitions?projectId=${projectId}&type=label`);
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error("Project labels API returned:", data);
        return [];
      }
      return (data as any[]).map(d => ({ ...d, color: d.color as TagColor })) as ProjectLabel[];
    },
    enabled: !!projectId,
  });

  const createLabel = useMutation({
    mutationFn: async ({ labelTypeId, name, color, userId }: { labelTypeId: string; name: string; color: string; userId: string }) => {
      if (!projectId) throw new Error('No project ID');
      const res = await apiFetch(`/api/definitions?type=label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, label_type_id: labelTypeId, name, color })
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label created');
    },
    onError: (error: any) => toast.error(`Failed to create label: ${error.message}`),
  });

  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/definitions/${id}?type=label`, {
        method: "DELETE"
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label deleted');
    },
    onError: (error: any) => toast.error(`Failed to delete label: ${error.message}`),
  });

  const updateLabel = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      await apiFetch(`/api/definitions/${id}?type=label`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', projectId] });
      toast.success('Label updated');
    },
    onError: (error: any) => toast.error(`Failed to update label: ${error.message}`),
  });

  return { projectLabels, isLoading, createLabel, deleteLabel, updateLabel };
}

