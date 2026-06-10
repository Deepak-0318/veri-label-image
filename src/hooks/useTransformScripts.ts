import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TransformScript {
  id: string;
  name: string;
  code: string;
  output_format: string;
  created_at: string;
  updated_at: string;
}

export function useTransformScripts(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["transform_scripts", userId];

  const { data: scripts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("transform_scripts" as any)
        .select("*")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return (data as any[]) as TransformScript[];
    },
    enabled: !!userId,
  });

  const upsertScript = useMutation({
    mutationFn: async ({
      name,
      code,
      outputFormat,
    }: {
      name: string;
      code: string;
      outputFormat: string;
    }) => {
      if (!userId) throw new Error("Not authenticated");

      // Check if script with this name exists
      const existing = scripts.find((s) => s.name === name);

      if (existing) {
        const { error } = await supabase
          .from("transform_scripts" as any)
          .update({ code, output_format: outputFormat } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transform_scripts" as any)
          .insert({
            user_id: userId,
            name,
            code,
            output_format: outputFormat,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(`Failed to save script: ${error.message}`);
    },
  });

  const deleteScript = useMutation({
    mutationFn: async (scriptId: string) => {
      const { error } = await supabase
        .from("transform_scripts" as any)
        .delete()
        .eq("id", scriptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(`Failed to delete script: ${error.message}`);
    },
  });

  return { scripts, isLoading, upsertScript, deleteScript };
}
