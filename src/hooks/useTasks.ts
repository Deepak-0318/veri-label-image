import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuditEvent } from "@/services/auditLogger";

export interface Task {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  total_items: number;
  completed_items: number;
  qa_assigned_to: string | null;
  qa_status: string | null;
  created_at: string;
  updated_at: string;
}

export function useTasks(userId: string | undefined, projectId?: string) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', userId, projectId],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!userId,
  });

  const createTask = useMutation({
    mutationFn: async ({ name, description, project_id, assigned_to, total_items }: {
      name: string;
      description?: string;
      project_id: string;
      assigned_to?: string;
      total_items?: number;
    }) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          name,
          description: description || null,
          project_id,
          assigned_to: assigned_to || null,
          created_by: userId,
          total_items: total_items ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
      if (userId) {
        logAuditEvent({
          userId,
          action: "create_task",
          category: "task",
          entityType: "task",
          entityId: data.id,
          entityName: data.name,
          description: `created task "${data.name}"`,
          newValues: { name: data.name, assigned_to: data.assigned_to, project_id: data.project_id },
        });
      }
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
      if (userId) {
        logAuditEvent({
          userId,
          action: "update_task",
          category: "task",
          entityType: "task",
          entityId: data.id,
          entityName: data.name,
          description: `updated task "${data.name}"${variables.status ? ` → ${variables.status}` : ''}`,
          newValues: variables as Record<string, unknown>,
        });
      }
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
      if (userId) {
        logAuditEvent({
          userId,
          action: "delete_task",
          category: "task",
          entityType: "task",
          entityId: id,
          description: `deleted a task`,
        });
      }
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return { tasks, isLoading, createTask, updateTask, deleteTask };
}
