import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserReportData {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
  periodStart: string;
  periodEnd: string;
  totalAnnotations: number;
  annotationsByProject: { projectId: string; projectName: string; count: number }[];
  tasksCompleted: number;
  subTasksCompleted: number;
  qcReviewed: number;
  qcApproved: number;
  qcRework: number;
  qcAccuracy: number; // 0-100
  dailyActivity: { date: string; count: number }[];
  qaTasksCompleted: number; // QC role: tasks they QA'd
}

interface Params {
  userIds: string[];
  start: Date;
  end: Date;
  enabled?: boolean;
}

export function useUserReports({ userIds, start, end, enabled = true }: Params) {
  return useQuery({
    queryKey: ["user-reports", userIds.sort().join(","), start.toISOString(), end.toISOString()],
    enabled: enabled && userIds.length > 0,
    queryFn: async (): Promise<Record<string, UserReportData>> => {
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Annotations created by these users in the period (with project name)
      const { data: annotations, error: annErr } = await supabase
        .from("annotations")
        .select("id, user_id, project_id, qc_status, created_at, projects(name)")
        .in("user_id", userIds)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (annErr) throw annErr;

      // Tasks assigned to these users completed in the period
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, assigned_to, qa_assigned_to, status, qa_status, updated_at")
        .or(`assigned_to.in.(${userIds.join(",")}),qa_assigned_to.in.(${userIds.join(",")})`)
        .gte("updated_at", startISO)
        .lte("updated_at", endISO);
      if (tasksErr) throw tasksErr;

      // Sub-tasks completed by these users (sub_tasks have no user; via task assigned_to)
      const taskIds = (tasks ?? []).map((t: any) => t.id);
      let subTasks: any[] = [];
      if (taskIds.length > 0) {
        const { data: st, error: stErr } = await supabase
          .from("sub_tasks")
          .select("id, task_id, status, updated_at")
          .in("task_id", taskIds)
          .eq("status", "completed")
          .gte("updated_at", startISO)
          .lte("updated_at", endISO);
        if (stErr) throw stErr;
        subTasks = st ?? [];
      }

      // Profile lookup
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Roles
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const result: Record<string, UserReportData> = {};

      for (const uid of userIds) {
        const profile = profiles?.find((p: any) => p.id === uid);
        const userRoles = (roleRows ?? []).filter((r: any) => r.user_id === uid).map((r: any) => r.role);
        const userAnns = (annotations ?? []).filter((a: any) => a.user_id === uid);

        // Annotations by project
        const projMap = new Map<string, { name: string; count: number }>();
        for (const a of userAnns) {
          const pid = a.project_id || "unknown";
          const pname = (a.projects as any)?.name || "Unknown project";
          const cur = projMap.get(pid) || { name: pname, count: 0 };
          cur.count += 1;
          projMap.set(pid, cur);
        }

        // QC stats: based on annotations created by this user that have a qc_status
        const reviewed = userAnns.filter((a: any) => a.qc_status);
        const approved = reviewed.filter((a: any) => a.qc_status === "approved").length;
        const rework = reviewed.filter((a: any) => a.qc_status === "rework").length;
        const accuracy = reviewed.length > 0 ? (approved / reviewed.length) * 100 : 0;

        // Tasks completed (assigned annotator)
        const tasksDone = (tasks ?? []).filter(
          (t: any) => t.assigned_to === uid && t.status === "completed",
        ).length;

        // QA tasks completed (QC role)
        const qaDone = (tasks ?? []).filter(
          (t: any) => t.qa_assigned_to === uid && t.qa_status === "completed",
        ).length;

        // Sub-tasks completed (via tasks assigned to this user)
        const userTaskIds = new Set(
          (tasks ?? []).filter((t: any) => t.assigned_to === uid).map((t: any) => t.id),
        );
        const subDone = subTasks.filter((s: any) => userTaskIds.has(s.task_id)).length;

        // Daily activity from annotation created_at
        const daily = new Map<string, number>();
        for (const a of userAnns) {
          const d = new Date(a.created_at).toISOString().slice(0, 10);
          daily.set(d, (daily.get(d) || 0) + 1);
        }
        const dailyActivity = Array.from(daily.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        result[uid] = {
          userId: uid,
          fullName: profile?.full_name || profile?.email || "Unknown",
          email: profile?.email || "",
          roles: userRoles,
          periodStart: startISO,
          periodEnd: endISO,
          totalAnnotations: userAnns.length,
          annotationsByProject: Array.from(projMap.entries()).map(([projectId, v]) => ({
            projectId,
            projectName: v.name,
            count: v.count,
          })),
          tasksCompleted: tasksDone,
          subTasksCompleted: subDone,
          qcReviewed: reviewed.length,
          qcApproved: approved,
          qcRework: rework,
          qcAccuracy: accuracy,
          dailyActivity,
          qaTasksCompleted: qaDone,
        };
      }

      return result;
    },
  });
}