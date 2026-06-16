import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskApi } from "@/services/apiClient";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuditEvent } from "@/services/auditLogger";
import { useUserRole } from "./useUserRole";

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

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  return session.access_token;
}

export function useTasks(
  userId: string | undefined,
  projectId?: string
) {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole(userId);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", userId, projectId, isAdmin],
    queryFn: async () => {
      if (!userId) return [];

      const token = await getAccessToken();

      let tasks = await TaskApi.getTasks(token);

      if (projectId) {
        tasks = tasks.filter(
          (t: Task) => t.project_id === projectId
        );
      }

      if (!isAdmin) {
        tasks = tasks.filter(
          (t: Task) =>
            t.assigned_to === userId ||
            t.qa_assigned_to === userId ||
            (!t.assigned_to && !t.qa_assigned_to)
        );
      }

      return tasks as Task[];
    },
    enabled: !!userId,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      throw new Error(
        "Task creation is handled through TaskCreateDialog and /api/tasks"
      );
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Task> & { id: string }) => {
      const token = await getAccessToken();

      return await TaskApi.update(
        id,
        {
          name: updates.name,
          description: updates.description,
          status: updates.status,
          assignedTo: updates.assigned_to,
          qaAssignedTo: updates.qa_assigned_to,
        },
        token
      );
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });

      toast.success("Task updated");

      if (userId) {
        logAuditEvent({
          userId,
          action: "update_task",
          category: "task",
          entityType: "task",
          entityId: data.id,
          entityName: data.name,
          description: `updated task "${data.name}"${
            variables.status
              ? ` → ${variables.status}`
              : ""
          }`,
          newValues:
            variables as Record<string, unknown>,
        });
      }
    },

    onError: (e: Error) =>
      toast.error(`Failed: ${e.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();

      await TaskApi.delete(id, token);
    },

    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });

      toast.success("Task deleted");

      if (userId) {
        logAuditEvent({
          userId,
          action: "delete_task",
          category: "task",
          entityType: "task",
          entityId: id,
          description: "deleted a task",
        });
      }
    },

    onError: (e: Error) =>
      toast.error(`Failed: ${e.message}`),
  });

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
  };
}