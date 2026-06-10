import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AuditCategory } from "@/services/auditLogger";

export interface AuditLogEntry {
  id: string;
  user_id: string;
  organization_id: string | null;
  action: string;
  category: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  description: string;
  metadata: Record<string, unknown>;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  // Joined
  user_email?: string;
  user_name?: string;
}

export function useAuditLogs(organizationId: string | undefined, filters?: {
  category?: AuditCategory;
  userId?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["audit-logs", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 200);

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.search) {
        query = query.ilike("description", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with profile names
      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return (data || []).map((log: any) => {
        const profile = profileMap.get(log.user_id);
        return {
          ...log,
          user_email: profile?.email ?? "Unknown",
          user_name: profile?.full_name ?? profile?.email?.split("@")[0] ?? "Unknown",
        } as AuditLogEntry;
      });
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}
