import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "./useUserRole";
import { apiFetch } from "@/services/api";
import { getActiveOrganizationId } from "@/hooks/useOrganizations";

export interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  roles: AppRole[];
  created_at: string;
}

export const getToken = (): string | null => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageKey = `sb-${projectId}-auth-token`;

  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
};

export function useTeam() {
  const queryClient = useQueryClient();
  const activeOrgId = getActiveOrganizationId();

  const { data: members = [], isLoading } = useQuery({
  queryKey: ["team-members", activeOrgId],
  queryFn: async () => {
    if (!activeOrgId) return [];

    const token = getToken();

    const res = await apiFetch(`/api/team/${activeOrgId}`, {
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to fetch team");
    }

    return await res.json(); // already matches TeamMember[]
  },
  enabled: !!activeOrgId,
});

  const addMember = useMutation({
  mutationFn: async ({ userId, invitedBy }: { userId: string; invitedBy: string }) => {
    const token = getToken();

    const res = await apiFetch(`/api/team/add`, {
      method: "POST",
      body: JSON.stringify({ organizationId: activeOrgId, userId, invitedBy }),
    });

    if (!res.ok) throw new Error("Failed to add member");
    },
    onError: (e) => toast.error(`Failed to add member: ${e.message}`),
  });

  const removeMember = useMutation({
  mutationFn: async (userId: string) => {
    const token = getToken();

    const res = await apiFetch(`/api/team/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ organizationId: activeOrgId, userId }),
    });

    if (!res.ok) throw new Error("Failed to remove member");
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", activeOrgId] });
      toast.success("Member removed from team");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const assignRole = useMutation({
  mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
    const token = getToken();
    const orgId = getActiveOrganizationId();

    const res = await apiFetch(`/api/team/assign-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, orgId, role }),
    });

    if (!res.ok) throw new Error("Failed to assign role");
  },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const removeRole = useMutation({
  mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
    const token = getToken();
    const orgId = getActiveOrganizationId();

    const res = await apiFetch(`/api/team/remove-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, orgId, role }),
    });

    if (!res.ok) throw new Error("Failed to remove role");
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", activeOrgId] });
      toast.success("Role removed");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return { members, isLoading, addMember, removeMember, assignRole, removeRole };
}
