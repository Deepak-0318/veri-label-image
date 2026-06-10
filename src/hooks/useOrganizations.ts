import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgSummary {
  id: string;
  name: string;
  owner_id: string;
  is_owner: boolean;
}

const ACTIVE_ORG_KEY = "datamuse_active_org_id";
const ACTIVE_ORG_EVENT = "datamuse:active-org-change";

export function getActiveOrganizationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrganizationId(orgId: string | null) {
  try {
    if (orgId) localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    else localStorage.removeItem(ACTIVE_ORG_KEY);
    window.dispatchEvent(new CustomEvent(ACTIVE_ORG_EVENT, { detail: orgId }));
  } catch {
    // ignore
  }
}

export function useActiveOrganizationId() {
  const [orgId, setOrgId] = useState<string | null>(() => getActiveOrganizationId());

  useEffect(() => {
    const handler = (e: Event) => {
      setOrgId((e as CustomEvent<string | null>).detail ?? getActiveOrganizationId());
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === ACTIVE_ORG_KEY) setOrgId(e.newValue);
    };
    window.addEventListener(ACTIVE_ORG_EVENT, handler as EventListener);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(ACTIVE_ORG_EVENT, handler as EventListener);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const update = useCallback((id: string | null) => {
    setActiveOrganizationId(id);
    setOrgId(id);
  }, []);

  return [orgId, update] as const;
}

export function useOrganizations(userId: string | undefined) {
  return useQuery({
    queryKey: ["organizations-list", userId],
    enabled: !!userId,
    queryFn: async (): Promise<OrgSummary[]> => {
      if (!userId) return [];

      // Orgs the user is a member of
      const { data: memberships, error: mErr } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(id, name, owner_id)")
        .eq("user_id", userId);
      if (mErr) throw mErr;

      // Orgs the user owns (owner may not have a membership row)
      const { data: owned, error: oErr } = await supabase
        .from("organizations")
        .select("id, name, owner_id")
        .eq("owner_id", userId);
      if (oErr) throw oErr;

      const map = new Map<string, OrgSummary>();
      for (const m of memberships ?? []) {
        const o = (m as any).organizations;
        if (o?.id) {
          map.set(o.id, { id: o.id, name: o.name, owner_id: o.owner_id, is_owner: o.owner_id === userId });
        }
      }
      for (const o of owned ?? []) {
        map.set(o.id, { id: o.id, name: o.name, owner_id: o.owner_id, is_owner: true });
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}