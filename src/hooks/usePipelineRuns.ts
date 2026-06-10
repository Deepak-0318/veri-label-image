import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  project_id: string | null;
  started_by: string;
  status: string;
  progress: number;
  total_items: number;
  completed_items: number;
  file_ids?: string[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  pipeline?: {
    id: string;
    name: string;
    pipeline_type: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export function usePipelineRuns(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["pipeline_runs", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("*, pipeline:pipelines(id, name, pipeline_type), project:projects(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as PipelineRun[]) ?? [];
    },
    enabled: !!userId,
  });

  // Real-time subscription for pipeline_runs changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("pipeline_runs_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipeline_runs",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipeline_runs", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const createRun = useMutation({
    mutationFn: async ({
      pipeline_id,
      project_id,
      total_items,
      file_ids: _file_ids,
    }: {
      pipeline_id: string;
      project_id?: string;
      total_items: number;
      file_ids?: string[];
    }) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pipeline_runs")
        .insert({
          pipeline_id,
          project_id: project_id || null,
          started_by: userId,
          status: "running",
          total_items,
        })
        .select("*, pipeline:pipelines(id, name, pipeline_type), project:projects(id, name)")
        .single();
      if (error) throw error;
      return data as unknown as PipelineRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_runs"] });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const updateRun = useMutation({
    mutationFn: async ({
      id,
      status,
      progress,
      completed_items,
      error_message,
    }: {
      id: string;
      status?: string;
      progress?: number;
      completed_items?: number;
      error_message?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (status !== undefined) updates.status = status;
      if (progress !== undefined) updates.progress = progress;
      if (completed_items !== undefined) updates.completed_items = completed_items;
      if (error_message !== undefined) updates.error_message = error_message;
      if (status === "completed" || status === "failed") {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("pipeline_runs")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_runs", userId] });
    },
    onError: (e) => toast.error(`Failed to update run: ${e.message}`),
  });

  const cancelRun = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from("pipeline_runs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_runs", userId] });
      toast.success("Pipeline run cancelled");
    },
    onError: (e) => toast.error(`Failed to cancel: ${e.message}`),
  });

  const activeRuns = runs.filter((r) =>
    ["queued", "running"].includes(r.status)
  );
  const completedRuns = runs.filter((r) =>
    ["completed", "failed", "cancelled"].includes(r.status)
  );

  return { runs, activeRuns, completedRuns, isLoading, createRun, updateRun, cancelRun };
}
