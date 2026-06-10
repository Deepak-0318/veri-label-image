import { supabase } from "@/integrations/supabase/client";

export type AuditCategory = "auth" | "crud" | "annotation" | "task" | "qc" | "team" | "pipeline" | "ai" | "general";

export interface AuditLogParams {
  userId: string;
  action: string;
  category: AuditCategory;
  description: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit logger.
 * Records user/AI actions with optional before/after change details.
 */
export async function logAuditEvent(params: AuditLogParams) {
  try {
    // Get the user's organization ID
    const { data: orgData } = await supabase
      .rpc("get_user_org_id", { _user_id: params.userId });

    await supabase.from("audit_logs").insert([
      {
        user_id: params.userId,
        organization_id: orgData ?? null,
        action: params.action,
        category: params.category,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        entity_name: params.entityName ?? null,
        description: params.description,
        old_values: params.oldValues ?? null,
        new_values: params.newValues ?? null,
        metadata: params.metadata ?? {},
      } as any,
    ]);
  } catch {
    // Silent fail — audit logging should never block the user
  }
}
