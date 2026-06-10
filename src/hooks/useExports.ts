import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivityEvent } from "@/services/activityLogger";

export interface ExportRecord {
  id: string;
  name: string;
  format: string;
  file_count: number;
  annotation_count: number;
  status: string;
  download_url: string | null;
  created_at: string;
}

export function useExports(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: exports = [], isLoading } = useQuery({
    queryKey: ["exports", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("exports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExportRecord[];
    },
    enabled: !!userId,
  });

  const createExport = useMutation({
    mutationFn: async ({
      name,
      format,
      fileCount,
      annotationCount,
      exportData,
    }: {
      name: string;
      format: string;
      fileCount: number;
      annotationCount: number;
      exportData: string;
    }) => {
      if (!userId) throw new Error("Not authenticated");

      // Upload the export file to storage
      const timestamp = Date.now();
      const ext = format === "json" ? "json" : "csv";
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${userId}/exports/${timestamp}_${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("files")
        .upload(filePath, new Blob([exportData], { type: "text/plain" }), {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("files")
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from("exports")
        .insert({
          user_id: userId,
          name,
          format,
          file_count: fileCount,
          annotation_count: annotationCount,
          status: "completed",
          download_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ExportRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exports", userId] });
      toast.success("Export created successfully");
      if (userId) {
        logActivityEvent({
          userId,
          eventType: "export",
          entityType: "export",
          entityId: data.id,
          description: `Exported "${data.name}" as ${data.format.toUpperCase()}`,
        });
      }
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const deleteExport = useMutation({
    mutationFn: async (exportId: string) => {
      const { error } = await supabase
        .from("exports")
        .delete()
        .eq("id", exportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports", userId] });
      toast.success("Export deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete export: ${error.message}`);
    },
  });

  return { exports, isLoading, createExport, deleteExport };
}
