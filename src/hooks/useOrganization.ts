import { apiFetch } from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveOrganizationId, useOrganizations } from "./useOrganizations";

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

const getToken = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageKey = `sb-${projectId}-auth-token`;

  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw)?.access_token;
  } catch {
    return null;
  }
};

export function useOrganization(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [activeOrgId] = useActiveOrganizationId();
  const { data: orgList } = useOrganizations(userId);

  const { data: backendOrg, isLoading } = useQuery({
    queryKey: ["organization", userId],
    queryFn: async () => {
      if (!userId) return null;
      const token = getToken();
      const res = await apiFetch(`/api/organization`);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch organization");
      }
      return await res.json();
    },
    enabled: !!userId,
    retry: false
  });

  const createOrganization = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!userId) throw new Error("Not authenticated");
      const token = getToken();
      const res = await apiFetch(`/api/organization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create organization");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", userId] });
      toast.success("Organization created");
    },
    onError: (e) => toast.error(`Failed to create organization: ${e.message}`),
  });

  // Resolve the active organization. If the user has chosen one and it's in
  // their membership list, use it; otherwise fall back to the backend default.
  let organization = backendOrg as Organization | null | undefined;
  if (activeOrgId && orgList && orgList.length > 0) {
    const match = orgList.find((o) => o.id === activeOrgId);
    if (match) {
      organization = {
        id: match.id,
        name: match.name,
        owner_id: match.owner_id,
        created_at: (backendOrg as any)?.created_at ?? "",
        updated_at: (backendOrg as any)?.updated_at ?? "",
      };
    }
  }

  const isOwner = organization?.owner_id === userId;

  return { organization, isLoading, createOrganization, isOwner };
}
