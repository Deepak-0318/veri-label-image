import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BlockTemplate {
  id: string;
  name: string;
  category: string;
  block_type: string;
  description: string | null;
  icon: string;
  default_config: Record<string, any>;
  script: string | null;
  language: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useBlockTemplates(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["block_templates", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_block_templates" as any)
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as BlockTemplate[];
    },
    enabled: !!userId,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: {
      name: string;
      category?: string;
      block_type?: string;
      description?: string;
      icon?: string;
      default_config?: Record<string, any>;
      script?: string;
      language?: string;
    }) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pipeline_block_templates" as any)
        .insert({
          name: input.name,
          category: input.category || "custom",
          block_type: input.block_type || "custom",
          description: input.description || null,
          icon: input.icon || "Zap",
          default_config: input.default_config || {},
          script: input.script || null,
          language: input.language || "python",
          is_system: false,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BlockTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block_templates", userId] });
      toast.success("Block template created");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pipeline_block_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block_templates", userId] });
      toast.success("Block template deleted");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  // Group by category
  const grouped = templates.reduce<Record<string, BlockTemplate[]>>((acc, t) => {
    const cat = t.category || "custom";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return { templates, grouped, isLoading, createTemplate, deleteTemplate };
}
