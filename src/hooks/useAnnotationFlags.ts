import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AnnotationFlag {
  id: string;
  annotation_id: string;
  flag_id: string;
  created_at: string;
}

export function useAnnotationFlags(annotationIds: string[]) {
  const queryClient = useQueryClient();
  const key = ['annotation-flags', ...annotationIds.sort()];

  const { data: annotationFlags = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (annotationIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from('annotation_flags')
        .select('*')
        .in('annotation_id', annotationIds);
      if (error) throw error;
      return data as AnnotationFlag[];
    },
    enabled: annotationIds.length > 0,
  });

  const setFlags = useMutation({
    mutationFn: async ({ annotationId, flagIds }: { annotationId: string; flagIds: string[] }) => {
      const { data: existing, error: fetchErr } = await (supabase as any)
        .from('annotation_flags')
        .select('id, flag_id')
        .eq('annotation_id', annotationId);
      if (fetchErr) throw fetchErr;

      const existingFlagIds = (existing || []).map((e: any) => e.flag_id);
      const toAdd = flagIds.filter(f => !existingFlagIds.includes(f));
      const toRemove = (existing || []).filter((e: any) => !flagIds.includes(e.flag_id)).map((e: any) => e.id);

      if (toRemove.length > 0) {
        const { error } = await (supabase as any).from('annotation_flags').delete().in('id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await (supabase as any).from('annotation_flags').insert(
          toAdd.map(flagId => ({ annotation_id: annotationId, flag_id: flagId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotation-flags'] });
    },
    onError: (e) => toast.error(`Failed to update flags: ${e.message}`),
  });

  const getFlagsForAnnotation = (annotationId: string) =>
    annotationFlags.filter(af => af.annotation_id === annotationId).map(af => af.flag_id);

  return { annotationFlags, isLoading, setFlags, getFlagsForAnnotation };
}
