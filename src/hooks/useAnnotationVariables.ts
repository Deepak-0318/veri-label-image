import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AnnotationVariableValue = string | number | string[] | null;

export interface AnnotationVariableValueRow {
  id: string;
  annotation_id: string;
  variable_id: string;
  value: AnnotationVariableValue;
}

/**
 * Loads variable values for a set of annotations.
 * Returns a map: annotationId -> { variableId -> value }
 */
export function useAnnotationVariableValues(annotationIds: string[]) {
  const queryClient = useQueryClient();
  const sortedIds = [...annotationIds].sort();
  const queryKey = ["annotation-variable-values", ...sortedIds];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (annotationIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("annotation_variable_values")
        .select("*")
        .in("annotation_id", annotationIds);
      if (error) throw error;
      return data as AnnotationVariableValueRow[];
    },
    enabled: annotationIds.length > 0,
  });

  const valueMap: Record<string, Record<string, AnnotationVariableValue>> = {};
  for (const r of rows) {
    if (!valueMap[r.annotation_id]) valueMap[r.annotation_id] = {};
    valueMap[r.annotation_id][r.variable_id] = r.value;
  }

  const setValues = useMutation({
    mutationFn: async ({
      annotationId,
      values,
    }: {
      annotationId: string;
      values: Record<string, AnnotationVariableValue>;
    }) => {
      // Fetch existing rows for this annotation
      const { data: existing, error: fetchErr } = await (supabase as any)
        .from("annotation_variable_values")
        .select("id, variable_id")
        .eq("annotation_id", annotationId);
      if (fetchErr) throw fetchErr;

      const existingByVar = new Map<string, string>();
      for (const e of (existing || []) as { id: string; variable_id: string }[]) {
        existingByVar.set(e.variable_id, e.id);
      }

      const upserts: Array<{ id?: string; annotation_id: string; variable_id: string; value: any }> = [];
      const idsToDelete: string[] = [];

      for (const [variableId, value] of Object.entries(values)) {
        const isEmpty =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        const existingId = existingByVar.get(variableId);
        if (isEmpty) {
          if (existingId) idsToDelete.push(existingId);
        } else {
          upserts.push({
            ...(existingId ? { id: existingId } : {}),
            annotation_id: annotationId,
            variable_id: variableId,
            value,
          });
        }
      }

      if (idsToDelete.length > 0) {
        const { error } = await (supabase as any)
          .from("annotation_variable_values")
          .delete()
          .in("id", idsToDelete);
        if (error) throw error;
      }

      if (upserts.length > 0) {
        const { error } = await (supabase as any)
          .from("annotation_variable_values")
          .upsert(upserts, { onConflict: "annotation_id,variable_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annotation-variable-values"] });
    },
    onError: (e: Error) =>
      toast.error(`Failed to save variable values: ${e.message}`),
  });

  const getValuesForAnnotation = (annotationId: string) =>
    valueMap[annotationId] || {};

  return { rows, valueMap, getValuesForAnnotation, isLoading, setValues };
}