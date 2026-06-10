import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { apiFetch } from "@/services/api";

export interface SubTask {
  id: string;
  task_id: string;
  file_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  file?: {
    id: string;
    name: string;
    type: string;
    size: number | null;
    thumbnail_url: string | null;
    content: string | null;
  };
}

export function useSubTasks(taskId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: subTasks = [], isLoading } = useQuery({
    queryKey: ['sub_tasks', taskId],
   queryFn: async () => {
  if (!taskId) return [];

  const { data, error } = await supabase
    .from('sub_tasks')
    .select('*, file:files(id, name, type, size, thumbnail_url, content)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  const sasUpdated = await Promise.all(
    (data as unknown as SubTask[]).map(async (st) => {
      if (!st.file?.id) return st;

      try {
        const token = localStorage.getItem(
          `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`
        );
        const accessToken = token ? JSON.parse(token)?.access_token : null;

        const res = await apiFetch(`/api/files/${st.file.id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) return st;

        const fileData = await res.json();

        return {
          ...st,
          file: {
            ...st.file,
            thumbnail_url: fileData.sasUrl, 
          },
        };
      } catch {
        return st;
      }
    })
  );

  return sasUpdated;
},
    enabled: !!taskId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('sub_tasks')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub_tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return { subTasks, isLoading, updateStatus };
}
