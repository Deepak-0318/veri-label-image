import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/services/api";

export type VariableType = "number" | "text" | "single_select" | "multi_select";

export interface ProjectVariable {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  variable_type: VariableType;
  options: string[];
  is_required: boolean;
  min_value: number | null;
  max_value: number | null;
  display_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectVariableInput {
  name: string;
  description?: string;
  variable_type: VariableType;
  options?: string[];
  is_required?: boolean;
  min_value?: number | null;
  max_value?: number | null;
  userId: string;
}

export interface UpdateProjectVariableInput {
  id: string;
  name?: string;
  description?: string | null;
  variable_type?: VariableType;
  options?: string[];
  is_required?: boolean;
  min_value?: number | null;
  max_value?: number | null;
  display_order?: number;
}

export function useProjectVariables(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: variables = [], isLoading } = useQuery({
    queryKey: ["project-variables", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiFetch(`/api/definitions?projectId=${projectId}&type=variable`);
      const data = await res.json();
      return (data as any[]).map((row) => ({
        ...row,
        options: typeof row.options === 'string' ? JSON.parse(row.options) : (Array.isArray(row.options) ? row.options : []),
      })) as ProjectVariable[];
    },
    enabled: !!projectId,
  });

  const createVariable = useMutation({
    mutationFn: async (input: CreateProjectVariableInput) => {
      if (!projectId) throw new Error("No project ID");
      const payload = {
        project_id: projectId,
        name: input.name,
        description: input.description ?? null,
        variable_type: input.variable_type,
        options: input.variable_type === "single_select" || input.variable_type === "multi_select"
          ? JSON.stringify(input.options ?? [])
          : "[]",
        is_required: input.is_required ?? false,
        min_value: input.variable_type === "number" ? input.min_value : null,
        max_value: input.variable_type === "number" ? input.max_value : null,
      };

      const res = await apiFetch(`/api/definitions?type=variable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-variables", projectId] });
      toast.success("Variable created");
    },
    onError: (e: Error) => toast.error(`Failed to create variable: ${e.message}`),
  });

  const updateVariable = useMutation({
    mutationFn: async (input: UpdateProjectVariableInput) => {
      const { id, ...rest } = input;
      const payload: any = { ...rest };
      if (rest.options) {
        payload.options = JSON.stringify(rest.options);
      }
      await apiFetch(`/api/definitions/${id}?type=variable`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-variables", projectId] });
      toast.success("Variable updated");
    },
    onError: (e: Error) => toast.error(`Failed to update variable: ${e.message}`),
  });

  const deleteVariable = useMutation({
    mutationFn: async (variableId: string) => {
      await apiFetch(`/api/definitions/${variableId}?type=variable`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-variables", projectId] });
      toast.success("Variable deleted");
    },
    onError: (e: Error) => toast.error(`Failed to delete variable: ${e.message}`),
  });

  return { variables, isLoading, createVariable, updateVariable, deleteVariable };
}