import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityEvent {
  id: string;
  user_id: string;
  event_type: "upload" | "annotate" | "export" | "task" | "project" | "pipeline" | "team";
  entity_type: string;
  entity_id: string | null;
  project_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type CreateActivityEvent = Omit<ActivityEvent, "id" | "created_at">;

export function useActivityFeed(userId?: string, projectId?: string, limit = 50) {
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activity-events", userId, projectId, limit],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase
        .from("activity_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ActivityEvent[];
    },
    enabled: !!userId,
  });

  const logActivity = useMutation({
    mutationFn: async (event: CreateActivityEvent) => {
      const { data, error } = await supabase
        .from("activity_events")
        .insert([{
          user_id: event.user_id,
          event_type: event.event_type,
          entity_type: event.entity_type,
          entity_id: event.entity_id,
          project_id: event.project_id,
          description: event.description,
          metadata: event.metadata as any,
        }])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ActivityEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
    },
  });

  return { activities, isLoading, logActivity };
}
