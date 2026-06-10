import { usePendingInvitations, type PendingInvitation } from "@/hooks/usePendingInvitations";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Check, X, Loader2 } from "lucide-react";

export function InvitationBanner() {
  const { user } = useAuth();
  const { invitations, acceptInvitation, declineInvitation } = usePendingInvitations(user?.id, user?.email);

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      {invitations.map((inv) => (
        <Card key={inv.id} className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  You've been invited to join <strong>{inv.org_name}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Role: <span className="capitalize">{inv.role === 'qc' ? 'QC' : inv.role}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => declineInvitation.mutate(inv.id)}
                disabled={declineInvitation.isPending}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => acceptInvitation.mutate(inv)}
                disabled={acceptInvitation.isPending}
              >
                {acceptInvitation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Accept
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
