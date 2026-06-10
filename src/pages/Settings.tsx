import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Save, User, Mail, Loader2, Sun, Moon, Bell, BellOff,
  FolderKanban, Lock, Trash2, AlertTriangle, Shield, Building2, Check, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { RenderingPerformanceCard } from "@/components/settings/RenderingPerformanceCard";
import { useOrganizations, useActiveOrganizationId } from "@/hooks/useOrganizations";
import { useQueryClient } from "@tanstack/react-query";

const NOTIFICATION_DEFAULTS = {
  emailOnTaskAssigned: true,
  emailOnExportComplete: true,
  emailOnTeamInvite: true,
  showActivityFeed: true,
};

const PROJECT_DEFAULTS = {
  defaultDataType: "text",
  defaultAnnotationType: "classification",
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Organizations
  const { data: organizations = [], isLoading: orgsLoading } = useOrganizations(user?.id);
  const [activeOrgId, setActiveOrgId] = useActiveOrganizationId();
  const effectiveActiveOrgId =
    activeOrgId && organizations.some((o) => o.id === activeOrgId)
      ? activeOrgId
      : organizations[0]?.id ?? null;

  const handleSwitchOrganization = (orgId: string) => {
    if (orgId === effectiveActiveOrgId) return;
    setActiveOrgId(orgId);
    // Invalidate everything that depends on the active org so views refetch.
    queryClient.invalidateQueries();
    const target = organizations.find((o) => o.id === orgId);
    toast.success(`Switched to ${target?.name ?? "organization"}`);
  };

  // Profile
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Notifications (persisted in localStorage)
  const [notifications, setNotifications] = useState(NOTIFICATION_DEFAULTS);

  // Default project settings (persisted in localStorage)
  const [projectDefaults, setProjectDefaults] = useState(PROJECT_DEFAULTS);

  // Account deletion
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");

      // Load saved preferences
      const savedNotifs = localStorage.getItem(`datamuse_notifs_${user.id}`);
      if (savedNotifs) setNotifications(JSON.parse(savedNotifs));

      const savedDefaults = localStorage.getItem(`datamuse_proj_defaults_${user.id}`);
      if (savedDefaults) setProjectDefaults(JSON.parse(savedDefaults));
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (error) throw error;
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(`Failed to update profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(`Failed to change password: ${err.message}`);
    } finally {
      setChangingPassword(false);
    }
  };

  const updateNotification = (key: keyof typeof NOTIFICATION_DEFAULTS, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    if (user) localStorage.setItem(`datamuse_notifs_${user.id}`, JSON.stringify(updated));
    toast.success("Notification preference saved");
  };

  const updateProjectDefault = (key: keyof typeof PROJECT_DEFAULTS, value: string) => {
    const updated = { ...projectDefaults, [key]: value };
    setProjectDefaults(updated);
    if (user) localStorage.setItem(`datamuse_proj_defaults_${user.id}`, JSON.stringify(updated));
    toast.success("Default saved");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      // Sign out the user — actual account deletion requires admin/backend action
      await supabase.auth.signOut();
      toast.success("You have been signed out. Contact support to finalize account deletion.");
      navigate("/auth");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const themeOptions = [
    { value: "dark" as const, label: "Dark", icon: Moon, description: "Dark background for reduced eye strain" },
    { value: "light" as const, label: "Light", icon: Sun, description: "Light background for bright environments" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
          </div>

          {/* ─── Organization ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Organization
              </CardTitle>
              <CardDescription>
                Switch between organizations you belong to. Projects, tasks, team and reports will reload for the selected organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orgsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading organizations…
                </div>
              ) : organizations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You don't belong to any organization yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {organizations.map((org) => {
                    const isActive = org.id === effectiveActiveOrgId;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleSwitchOrganization(org.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-all",
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                              isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate flex items-center gap-2">
                              {org.name}
                              {org.is_owner && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500">
                                  <Crown className="h-3 w-3" /> Owner
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {isActive ? "Active organization" : "Click to switch"}
                            </p>
                          </div>
                        </div>
                        {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Note: roles are assigned per user across the platform. Project, file, task and team data will reflect only the selected organization.
              </p>
            </CardContent>
          </Card>

          {/* ─── Profile ───────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile
              </CardTitle>
              <CardDescription>Update your display name and view your account email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{user?.email || "Not signed in"}</span>
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* ─── Appearance ─────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>Choose your preferred theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {themeOptions.map(option => {
                  const Icon = option.icon;
                  const isActive = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        "flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all duration-200 cursor-pointer",
                        isActive
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"
                      )}
                    >
                      <div className={cn("rounded-full p-3 transition-colors", isActive ? "bg-primary/20" : "bg-muted")}>
                        <Icon className={cn("h-6 w-6", isActive ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="text-center">
                        <p className={cn("font-semibold text-sm", isActive ? "text-foreground" : "text-muted-foreground")}>
                          {option.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                      </div>
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ─── Rendering Performance ─────────────────── */}
          <RenderingPerformanceCard />

          {/* ─── Notifications ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>Control when and how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Task assignments</p>
                  <p className="text-xs text-muted-foreground">Get notified when a task is assigned to you</p>
                </div>
                <Switch
                  checked={notifications.emailOnTaskAssigned}
                  onCheckedChange={v => updateNotification("emailOnTaskAssigned", v)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Export completion</p>
                  <p className="text-xs text-muted-foreground">Get notified when an export finishes</p>
                </div>
                <Switch
                  checked={notifications.emailOnExportComplete}
                  onCheckedChange={v => updateNotification("emailOnExportComplete", v)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Team invitations</p>
                  <p className="text-xs text-muted-foreground">Get notified when you're invited to a team</p>
                </div>
                <Switch
                  checked={notifications.emailOnTeamInvite}
                  onCheckedChange={v => updateNotification("emailOnTeamInvite", v)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Activity feed</p>
                  <p className="text-xs text-muted-foreground">Show activity feed on dashboard</p>
                </div>
                <Switch
                  checked={notifications.showActivityFeed}
                  onCheckedChange={v => updateNotification("showActivityFeed", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ─── Default Project Settings ──────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                Default Project Settings
              </CardTitle>
              <CardDescription>Set defaults for new projects you create</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Data Type</Label>
                <Select
                  value={projectDefaults.defaultDataType}
                  onValueChange={v => updateProjectDefault("defaultDataType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="tabular">Tabular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Annotation Type</Label>
                <Select
                  value={projectDefaults.defaultAnnotationType}
                  onValueChange={v => updateProjectDefault("defaultAnnotationType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">Classification</SelectItem>
                    <SelectItem value="bounding_box">Bounding Box</SelectItem>
                    <SelectItem value="segmentation">Segmentation</SelectItem>
                    <SelectItem value="ner">Named Entity Recognition</SelectItem>
                    <SelectItem value="transcription">Transcription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ─── Security ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Security
              </CardTitle>
              <CardDescription>Change your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                Update Password
              </Button>
            </CardContent>
          </Card>

          {/* ─── Danger Zone ───────────────────────────── */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions that affect your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account
                        and remove all your data including projects, files, and annotations.
                        <br /><br />
                        Type <strong>DELETE</strong> to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      placeholder="Type DELETE to confirm"
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      className="mt-2"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "DELETE" || deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Delete My Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Bottom spacing */}
          <div className="h-8" />
        </div>
      </main>
    </div>
  );
}
