import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PipelineBlock {
  id: string;
  type: 'ai' | 'function' | 'custom' | 'logical' | 'io';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  connections: string[]; // ids of blocks this connects to
}

export interface Pipeline {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  pipeline_type: string;
  config: PipelineBlock[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function usePipelines(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['pipelines', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => {
        let config: PipelineBlock[] = [];
        if (Array.isArray(p.config)) {
          config = p.config;
        } else if (typeof p.config === "string") {
          try { config = JSON.parse(p.config); } catch { config = []; }
        }
        console.log("Pipeline loaded:", { id: p.id, name: p.name, configLength: config.length, config });
        return { ...p, config };
      }) as Pipeline[];
    },
    enabled: !!userId,
  });

  const createPipeline = useMutation({
    mutationFn: async ({ name, description, pipeline_type, project_id }: {
      name: string;
      description?: string;
      pipeline_type?: string;
      project_id?: string;
    }) => {
      if (!userId) throw new Error("Not authenticated");
      const payload = {
        name,
        description: description || null,
        pipeline_type: pipeline_type || "auto_tagging",
        project_id: project_id || null,
        created_by: userId,
      };
      console.log("Pipeline Create Payload:", payload);
      const { data, error } = await supabase
        .from('pipelines')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      console.log("Pipeline Saved:", data);
      return data as unknown as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', userId] });
      toast.success('Pipeline created');
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const updatePipeline = useMutation({
    mutationFn: async ({ id, name, description, config }: {
      id: string;
      name?: string;
      description?: string;
      config?: PipelineBlock[];
    }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (config !== undefined) updates.config = config;
      console.log("Pipeline before save:", { id, name, configLength: config?.length, config });
      const { data, error } = await supabase
        .from('pipelines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      console.log("Pipeline save payload saved:", { id: data.id, name: data.name, configLength: Array.isArray(data.config) ? data.config.length : 0 });
      return data as unknown as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', userId] });
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipelines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', userId] });
      toast.success('Pipeline deleted');
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return { pipelines, isLoading, createPipeline, updatePipeline, deletePipeline };
}
