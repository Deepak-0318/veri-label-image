import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { apiFetch } from "@/services/api";

export interface PendingInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  invited_by: string;
  status: string;
  created_at: string;
  org_name?: string;
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

export function usePendingInvitations(userId: string | undefined, userEmail?: string | null) {
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["pending-invitations", userId, userEmail],
    queryFn: async () => {
      if (!userId || !userEmail) return [];
      const res = await apiFetch(
        `/api/invitations?email=${encodeURIComponent(userEmail.toLowerCase())}`,
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch invitations");
      }

      return await res.json();

    },
    enabled: !!userId && !!userEmail,
    retry:false
  });

  const acceptInvitation = useMutation({
    mutationFn: async (invitation: PendingInvitation) => {
      if (!userId) throw new Error("Not authenticated");

      const token = getToken();
      const res = await apiFetch(`/api/invitations/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invitationId: invitation.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept invitation");
      }
    },
    onSuccess: (_, inv) => {
      queryClient.invalidateQueries({ queryKey: ["pending-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-role"] });
      toast.success(`Joined ${inv.org_name}!`);
    },
    onError: (e) => toast.error(`Failed to accept invitation: ${e.message}`),
  });

  const declineInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const token = getToken();
      const res = await apiFetch(`/api/invitations/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invitationId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to decline invitation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-invitations"] });
      toast.success("Invitation declined");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

    const inviteMember = useMutation({
      mutationFn: async ({
        organizationId,
        email,
        role,
      }: {
        organizationId: string;
        email: string;
        role: string;
      }) => {
        const token = getToken();

        const res = await apiFetch(`/api/invitations/invite`, {
          method: "POST",
          headers: {
          "Content-Type": "application/json"
        },
          body: JSON.stringify({
            organizationId,
            email,
            role,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to invite");
        }

        return await res.json();
      },
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: ["team-members"] });
        toast.success(`Invitation sent to ${vars.email}`);
      },
      onError: (e: any) => {
        if (e.message.includes("duplicate")) {
          toast.info("An invitation has already been sent to this email");
        } else if (e.message.includes("already")) {
          toast.info("This user is already a team member");
        } else {
          toast.error(`Failed to invite: ${e.message}`);
        }
      },
    });

  return { invitations, isLoading, acceptInvitation, declineInvitation,inviteMember };
}
