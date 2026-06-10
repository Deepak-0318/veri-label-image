import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget activity event logger.
 * Call from mutation onSuccess callbacks to record user actions.
 */
export async function logActivityEvent(params: {
  userId: string;
  eventType: "upload" | "annotate" | "export" | "task" | "project" | "pipeline" | "team" | "import";
  entityType: string;
  description: string;
  entityId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("activity_events").insert([
      {
        user_id: params.userId,
        event_type: params.eventType,
        entity_type: params.entityType,
        entity_id: params.entityId ?? null,
        project_id: params.projectId ?? null,
        description: params.description,
        metadata: params.metadata ?? {},
      } as any,
    ]);
  } catch {
    // Silent fail — activity logging should never block the user
  }
}
