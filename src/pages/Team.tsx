import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useTeam, type TeamMember } from "@/hooks/useTeam";
import { useOrganization } from "@/hooks/useOrganization";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Pencil as PencilIcon,
  Trash2,
  Loader2,
  LogIn,
  Crown,
  Lock,
  Search,
  ScrollText,
} from "lucide-react";
import { BarChart3 } from "lucide-react";
import { TeamReports } from "@/components/team/TeamReports";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/services/auditLogger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InvitationBanner } from "@/components/InvitationBanner";

const ROLE_CONFIG: Record<AppRole, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: "Admin", color: "bg-destructive/15 text-destructive border-destructive/30", icon: Crown },
  manager: { label: "Manager", color: "bg-primary/15 text-primary border-primary/30", icon: ShieldCheck },
  annotator: { label: "Annotator", color: "bg-secondary text-secondary-foreground border-border", icon: Shield },
  qc: { label: "QC", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: ShieldCheck },
};

function PaginatedTeamTable({ members, user, canManage, openRoleDialog, setRemoveTarget }: {
  members: TeamMember[];
  user: any;
  canManage: boolean;
  openRoleDialog: (m: TeamMember) => void;
  setRemoveTarget: (m: TeamMember) => void;
}) {
  const { paginatedItems, currentPage, totalPages, totalItems, setCurrentPage } = usePagination(members, 8);
  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((member) => {
              const isSelf = member.id === user?.id;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                        {member.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {member.full_name}
                          {isSelf && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {member.roles.length === 0 ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">No role</Badge>
                      ) : (
                        member.roles.map((role) => {
                          const config = ROLE_CONFIG[role];
                          return <Badge key={role} variant="outline" className={cn("text-xs", config.color)}>{config.label}</Badge>;
                        })
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(member.created_at), "MMM d, yyyy")}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {!isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRoleDialog(member)}>
                              <PencilIcon className="h-4 w-4 mr-2" />Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoveTarget(member)}>
                              <Trash2 className="h-4 w-4 mr-2" />Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} onPageChange={setCurrentPage} />
    </>
  );
}

export default function Team() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isManager, isLoading: roleLoading } = useUserRole(user?.id);
  const { organization, isLoading: orgLoading, createOrganization } = useOrganization(user?.id);
  const { members, isLoading, assignRole, removeRole, removeMember, addMember } = useTeam();
  const { inviteMember } = usePendingInvitations(user?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("annotator");
  const [inviting, setInviting] = useState(false);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("annotator");

  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const [createOrgName, setCreateOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const canManage = isAdmin || isManager;
  const canView = isAdmin || isManager;

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.roles.some((r) => r.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const handleInvite = async () => {
  if (!inviteEmail.trim() ) return;

  setInviting(true);

  try {
    const email = inviteEmail.trim().toLowerCase();
    await inviteMember.mutateAsync({
      organizationId: organization.id,
      email,
      role: inviteRole,
    });

    setInviteEmail("");
    setInviteOpen(false);

    logAuditEvent({
      userId: user.id,
      action: "invite_member",
      category: "team",
      entityType: "invitation",
      entityName: email,
      description: `invited ${email} as ${inviteRole}`,
      newValues: { email, role: inviteRole },
    });

  } catch (e: any) {
    // already handled in hook
  } finally {
    setInviting(false);
  }
};

  const handleChangeRole = async () => {
    if (!roleTarget) return;
    // Remove all existing roles first, then assign new one
    for (const r of roleTarget.roles) {
      await removeRole.mutateAsync({ userId: roleTarget.id, role: r });
    }
    await assignRole.mutateAsync({ userId: roleTarget.id, role: newRole });
    
    // Refresh team list
    await queryClient.invalidateQueries({ queryKey: ["team-members"] });
    
    if (user) {
      logAuditEvent({
        userId: user.id,
        action: "change_role",
        category: "team",
        entityType: "member",
        entityId: roleTarget.id,
        entityName: roleTarget.full_name,
        description: `changed ${roleTarget.full_name}'s role to ${newRole}`,
        oldValues: { roles: roleTarget.roles },
        newValues: { role: newRole },
      });
    }
    setRoleDialogOpen(false);
    setRoleTarget(null);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    await removeMember.mutateAsync(removeTarget.id);
    if (user) {
      logAuditEvent({
        userId: user.id,
        action: "remove_member",
        category: "team",
        entityType: "member",
        entityId: removeTarget.id,
        entityName: removeTarget.full_name,
        description: `removed ${removeTarget.full_name} from team`,
      });
    }
    setRemoveTarget(null);
  };

  const openRoleDialog = (member: TeamMember) => {
    setRoleTarget(member);
    setNewRole(member.roles[0] || "annotator");
    setRoleDialogOpen(true);
  };

  if (!user && !authLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Users className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view the team</h2>
            <Button onClick={() => navigate("/auth")}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // No organization yet — prompt to create one

  const handleCreateOrg = async () => {
    if (!createOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      await createOrganization.mutateAsync({ name: createOrgName.trim() });
      setCreateOrgName("");
    } finally {
      setCreatingOrg(false);
    }
  };

  if (orgLoading) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    </div>
  );
  }
  else if (!organization && user){
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <Users className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Create Your Organization</h2>
            <p className="text-muted-foreground">
              Set up an organization to manage your team members and collaborate on projects.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Organization name"
                value={createOrgName}
                onChange={(e) => setCreateOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
              />
              <Button onClick={handleCreateOrg} disabled={!createOrgName.trim() || creatingOrg}>
                {creatingOrg && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!roleLoading && !canView) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Access Restricted</h2>
            <p className="text-muted-foreground">Only admins and managers can view the team page.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Team</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {organization ? (
                  <>
                    <span className="font-medium text-foreground">{organization.name}</span>
                    {" · "}Manage team members and their roles
                  </>
                ) : (
                  "Manage team members and their roles"
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary/50 border-transparent"
                />
              </div>
            {canManage && (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join the platform. If they already have an account, the role will be assigned directly.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <Input
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annotator">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Annotator — Can annotate assigned tasks
                            </div>
                          </SelectItem>
                          <SelectItem value="qc">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              QC — Quality control on completed tasks
                            </div>
                          </SelectItem>
                          <SelectItem value="manager">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              Manager — Can manage projects, tasks & data
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4" />
                              Admin — Full platform access
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                      {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Send Invite
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>
        </header>

        <div className="p-8">
          {/* Pending Invitations Banner */}
          <div className="mb-6">
            <InvitationBanner />
          </div>

          <Tabs defaultValue="members" className="space-y-6">
            <TabsList>
              <TabsTrigger value="members" className="gap-2">
                <Users className="h-4 w-4" />
                Members
              </TabsTrigger>
              {canManage && (
                <TabsTrigger value="reports" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="audit" className="gap-2">
                  <ScrollText className="h-4 w-4" />
                  Audit Log
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="members" className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(["admin", "manager", "annotator", "qc"] as AppRole[]).map((role) => {
                  const config = ROLE_CONFIG[role];
                  const count = members.filter((m) => m.roles.includes(role)).length;
                  const Icon = config.icon;
                  return (
                    <div
                      key={role}
                      className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
                    >
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-sm text-muted-foreground">{config.label}s</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Members Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No team members yet</h2>
                  <p className="text-muted-foreground mb-4">
                    Invite members to start collaborating.
                  </p>
                </div>
              ) : (
                <PaginatedTeamTable members={filteredMembers} user={user} canManage={canManage} openRoleDialog={openRoleDialog} setRemoveTarget={setRemoveTarget} />
              )}
            </TabsContent>

            {isAdmin && (
              <TabsContent value="audit">
                <AuditTimeline organizationId={organization?.id} members={members} />
              </TabsContent>
            )}

            {canManage && (
              <TabsContent value="reports">
                <TeamReports members={members} organizationName={organization?.name || "Organization"} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {roleTarget?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annotator">Annotator</SelectItem>
                <SelectItem value="qc">QC</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={assignRole.isPending || removeRole.isPending}>
              {(assignRole.isPending || removeRole.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all roles from {removeTarget?.full_name} ({removeTarget?.email}).
              They will no longer have access to managed features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
