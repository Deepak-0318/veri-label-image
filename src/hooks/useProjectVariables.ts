import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data, error } = await (supabase as any)
        .from("project_variables")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((row) => ({
        ...row,
        options: Array.isArray(row.options) ? row.options : [],
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
        options: input.options ?? [],
        is_required: input.is_required ?? false,
        min_value: input.min_value ?? null,
        max_value: input.max_value ?? null,
        created_by: input.userId,
      };
      const { data, error } = await (supabase as any)
        .from("project_variables")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
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
      const { error } = await (supabase as any)
        .from("project_variables")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-variables", projectId] });
      toast.success("Variable updated");
    },
    onError: (e: Error) => toast.error(`Failed to update variable: ${e.message}`),
  });

  const deleteVariable = useMutation({
    mutationFn: async (variableId: string) => {
      const { error } = await (supabase as any)
        .from("project_variables")
        .delete()
        .eq("id", variableId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-variables", projectId] });
      toast.success("Variable deleted");
    },
    onError: (e: Error) => toast.error(`Failed to delete variable: ${e.message}`),
  });

  return { variables, isLoading, createVariable, updateVariable, deleteVariable };
}