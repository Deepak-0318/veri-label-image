import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TagColor } from "@/types/annotation";
import { toast } from "sonner";

export interface Label {
  id: string;
  name: string;
  color: TagColor;
}

interface DbLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

const defaultLabels: Label[] = [
  { id: 'default-1', name: 'Object', color: 'blue' },
  { id: 'default-2', name: 'Person', color: 'green' },
  { id: 'default-3', name: 'Vehicle', color: 'yellow' },
  { id: 'default-4', name: 'Positive Sentiment', color: 'cyan' },
  { id: 'default-5', name: 'Negative Sentiment', color: 'red' },
  { id: 'default-6', name: 'Key Feature', color: 'purple' },
];

export function useLabels(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: labels = defaultLabels, isLoading } = useQuery({
    queryKey: ['labels', userId],
    queryFn: async () => {
      if (!userId) return defaultLabels;

      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const userLabels = (data as DbLabel[]).map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color as TagColor,
      }));

      // Combine default labels with user labels
      return [...defaultLabels, ...userLabels];
    },
    enabled: !!userId,
  });

  const createLabel = useMutation({
    mutationFn: async ({ label, userId: uid }: { label: Omit<Label, 'id'>; userId: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .insert({
          user_id: uid,
          name: label.name,
          color: label.color,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        color: data.color as TagColor,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', userId] });
      toast.success('Label created');
    },
    onError: (error) => {
      toast.error(`Failed to create label: ${error.message}`);
    },
  });

  return {
    labels,
    isLoading,
    createLabel,
  };
}
