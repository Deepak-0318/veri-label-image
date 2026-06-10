import { useState } from "react";
import { InvitationBanner } from "@/components/InvitationBanner";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { AssignedTasksList } from "@/components/dashboard/AssignedTasksList";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { FileTypesChart } from "@/components/dashboard/FileTypesChart";
import { AnnotationProgressChart } from "@/components/dashboard/AnnotationProgressChart";
import { RecentFilesList } from "@/components/dashboard/RecentFilesList";
import { RecentActivity } from "@/components/RecentActivity";
import {
  Database, FileCheck, FolderKanban, Activity, ClipboardList,
  Search, Filter, LogIn, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFiles } from "@/hooks/useFiles";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization(user?.id);
  const { files } = useFiles(user?.id);
  const { tasks, isLoading: tasksLoading } = useTasks(user?.id);
  const { projects } = useProjects(user?.id);

  // All annotations for current user
  const { data: allAnnotations = [] } = useQuery({
    queryKey: ["all-annotations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("annotations")
        .select("id, file_id, label, color, created_at")
        .eq("user_id", user.id)
        .range(0, 49999);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const [searchQuery, setSearchQuery] = useState("");

  const annotatedFileCount = new Set(allAnnotations.map((a) => a.file_id)).size;
  const assignedTasks = tasks.filter((t) => t.assigned_to === user?.id);
  const taskCount = assignedTasks.filter((t) => t.status !== "completed").length;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {user ? "Overview of your annotation workspace" : "Sign in to save your work"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary/50 border-transparent focus:border-primary"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              {user ? (
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              ) : (
                <Button onClick={() => navigate("/auth")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* Pending Invitations */}
          <InvitationBanner />
          {/* Stats Row */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Files"
              value={files.length}
              subtitle={user ? "In your workspace" : "Demo files"}
              icon={Database}
            />
            <StatCard
              title="Annotated Files"
              value={user ? annotatedFileCount : "—"}
              subtitle={
                user
                  ? `${annotatedFileCount} of ${files.length} files`
                  : "Sign in to annotate"
              }
              icon={FileCheck}
            />
            <StatCard
              title="Total Annotations"
              value={user ? allAnnotations.length : "—"}
              subtitle={user ? "Across all files" : "Sign in to view"}
              icon={Activity}
            />
            <StatCard
              title="Active Tasks"
              value={user ? taskCount : "—"}
              subtitle={user ? `${taskCount} pending` : "Sign in to view"}
              icon={ClipboardList}
            />
          </section>

          {/* Assigned Tasks */}
          <AssignedTasksList tasks={assignedTasks} isLoading={tasksLoading} projects={projects} />

          {/* Charts + Activity Feed */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <ActivityChart files={files} annotations={allAnnotations} />
              <AnnotationProgressChart annotations={allAnnotations} />
            </div>
            <RecentActivity />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FileTypesChart files={files} />
            <RecentFilesList files={filteredFiles} />
          </section>
        </div>
      </main>
    </div>
  );
}
