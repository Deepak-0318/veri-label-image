import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Annotation, BoundingBoxAnnotation, PolygonAnnotation, TextHighlightAnnotation, RowAnnotation, AudioRegionAnnotation, FrameLabelAnnotation, VideoSegmentAnnotation, BoundingBox3dAnnotation, TagColor } from "@/types/annotation";
import { toast } from "sonner";
import { logActivityEvent } from "@/services/activityLogger";
import { logAuditEvent } from "@/services/auditLogger";
import { Json } from "@/integrations/supabase/types";

interface DbAnnotation {
  id: string;
  file_id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  label: string;
  color: string;
  data: Record<string, unknown>;
  label_type_id: string | null;
  comment: string | null;
  qc_status: string | null;
  qc_comment: string | null;
  created_at: string;
  updated_at: string;
}

// Convert database annotation to frontend format
function dbToAnnotation(db: DbAnnotation): Annotation {
  const base = {
    id: db.id,
    label: db.label,
    color: db.color as TagColor,
    labelTypeId: db.label_type_id || undefined,
    comment: db.comment || undefined,
    qc_status: db.qc_status || undefined,
    qc_comment: db.qc_comment || undefined,
    // Avoid using `any` by asserting a narrow shape for the optional DB-only field
    groupTypeId: ((db as unknown) as { group_type_id?: string | null }).group_type_id || undefined,
  };

  if (db.type === 'boundingBox' || db.type === 'mcapFrame') {
    const box =
      typeof db.data === 'string'
        ? JSON.parse(db.data) as { x: number; y: number; width: number; height: number; topicName?: string; frameIndex?: number; timestamp?: number }
        : db.data as { x: number; y: number; width: number; height: number; topicName?: string; frameIndex?: number; timestamp?: number };
    return {
      ...base,
      type: 'boundingBox',
      color: db.color === '#6366f1' ? 'blue' : 'green' as TagColor,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      topicName: box.topicName,
      frameIndex: box.frameIndex,
      timestamp: box.timestamp,
    } as BoundingBoxAnnotation;
  } else if (db.type === 'polygon') {
    const data = db.data as { points: { x: number; y: number }[]; topicName?: string; frameIndex?: number; timestamp?: number };
    return {
      ...base,
      type: 'polygon',
      points: data.points,
      topicName: data.topicName,
      frameIndex: data.frameIndex,
      timestamp: data.timestamp,
    } as PolygonAnnotation;
  } else if (db.type === 'textHighlight') {
    const data = db.data as { startOffset: number; endOffset: number; text: string };
    return {
      ...base,
      type: 'textHighlight',
      startOffset: data.startOffset,
      endOffset: data.endOffset,
      text: data.text,
    } as TextHighlightAnnotation;
  } else if (db.type === 'audioRegion') {
    const data = db.data as { startTime: number; endTime: number; transcript: string; speaker: string; language: string; emotion: string };
    return {
      ...base,
      type: 'audioRegion',
      startTime: data.startTime,
      endTime: data.endTime,
      transcript: data.transcript || '',
      speaker: data.speaker || '',
      language: data.language || '',
      emotion: data.emotion || '',
    } as AudioRegionAnnotation;
  } else if (db.type === 'frameLabel') {
    const data = db.data as { topicName: string; frameIndex: number; timestamp: number };
    return {
      ...base,
      type: 'frameLabel',
      topicName: data.topicName,
      frameIndex: data.frameIndex,
      timestamp: data.timestamp,
    } as FrameLabelAnnotation;
  } else if (db.type === 'videoSegment') {
    const data = db.data as { startTime: number; endTime: number; topicName?: string };
    return {
      ...base,
      type: 'videoSegment',
      startTime: data.startTime,
      endTime: data.endTime,
      topicName: data.topicName,
    } as VideoSegmentAnnotation;
  } else if (db.type === 'boundingBox3d') {
    const data = db.data as { cx: number; cy: number; cz: number; sx: number; sy: number; sz: number };
    return {
      ...base,
      type: 'boundingBox3d',
      cx: data.cx,
      cy: data.cy,
      cz: data.cz,
      sx: data.sx,
      sy: data.sy,
      sz: data.sz,
    } as BoundingBox3dAnnotation;
  } else {
    const data = db.data as { rowIndex: number };
    return {
      ...base,
      type: 'rowAnnotation',
      rowIndex: data.rowIndex,
    } as RowAnnotation;
  }
}

// Convert frontend annotation to database format
function annotationToDb(annotation: Annotation, fileId: string, userId: string, projectId?: string) {
  let data: Record<string, unknown>;

  if (annotation.type === 'boundingBox') {
    data = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
      ...(annotation.topicName && { topicName: annotation.topicName }),
      ...(annotation.frameIndex !== undefined && { frameIndex: annotation.frameIndex }),
      ...(annotation.timestamp !== undefined && { timestamp: annotation.timestamp }),
    };
  } else if (annotation.type === 'polygon') {
    data = {
      points: annotation.points,
      ...(annotation.topicName && { topicName: annotation.topicName }),
      ...(annotation.frameIndex !== undefined && { frameIndex: annotation.frameIndex }),
      ...(annotation.timestamp !== undefined && { timestamp: annotation.timestamp }),
    };
  } else if (annotation.type === 'textHighlight') {
    data = {
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      text: annotation.text,
    };
  } else if (annotation.type === 'audioRegion') {
    data = {
      startTime: annotation.startTime,
      endTime: annotation.endTime,
      transcript: annotation.transcript,
      speaker: annotation.speaker,
      language: annotation.language,
      emotion: annotation.emotion,
    };
  } else if (annotation.type === 'frameLabel') {
    data = {
      topicName: annotation.topicName,
      frameIndex: annotation.frameIndex,
      timestamp: annotation.timestamp,
    };
  } else if (annotation.type === 'videoSegment') {
    data = {
      startTime: annotation.startTime,
      endTime: annotation.endTime,
      ...(annotation.topicName && { topicName: annotation.topicName }),
    };
  } else if (annotation.type === 'boundingBox3d') {
    data = {
      cx: annotation.cx,
      cy: annotation.cy,
      cz: annotation.cz,
      sx: annotation.sx,
      sy: annotation.sy,
      sz: annotation.sz,
    };
  } else {
    data = { rowIndex: annotation.rowIndex };
  }

  return {
    id: annotation.id,
    file_id: fileId,
    user_id: userId,
    project_id: projectId || null,
    type: annotation.type,
    label: annotation.label,
    color: annotation.color,
    label_type_id: annotation.labelTypeId || null,
    comment: annotation.comment || null,
    group_type_id: annotation.groupTypeId || null,
    data,
  };
}

export function useAnnotations(fileId: string | undefined, projectId?: string | undefined) {
  const queryClient = useQueryClient();

  const { data: annotations = [], isLoading, error } = useQuery({
    queryKey: ['annotations', fileId, projectId],
    queryFn: async () => {
      if (!fileId) return [];

      let query = supabase
        .from('annotations')
        .select('*')
        .eq('file_id', fileId);

      if (projectId) {
        query = query.eq('project_id', projectId);
      } else {
        query = query.is('project_id', null);
      }

      const { data, error } = await query.order('created_at', { ascending: true }).range(0, 49999);
      
      console.log("SUPABASE ERROR", error);
      console.log("SUPABASE DATA", data);
      console.log("ANNOTATIONS RAW FROM DB", data);
      console.log("ANNOTATIONS RAW", data?.length);
      console.log("FILE ID", fileId);
      console.log("PROJECT ID", projectId);

      if (error) throw error;
        const converted = (data as DbAnnotation[]).map(dbToAnnotation);

        console.log("ANNOTATIONS CONVERTED", converted);
        console.log("FIRST CONVERTED", converted[0]);

        return converted;
        return (data as DbAnnotation[]).map(dbToAnnotation);
    },
    enabled: !!fileId,
  });

  const createAnnotation = useMutation({
    mutationFn: async ({ annotation, userId }: { annotation: Annotation; userId: string }) => {
      if (!fileId) throw new Error('No file ID');

      const dbAnnotation = annotationToDb(annotation, fileId, userId, projectId);
      const { data, error } = await supabase
        .from('annotations')
        .insert({
          id: dbAnnotation.id,
          file_id: dbAnnotation.file_id,
          user_id: dbAnnotation.user_id,
          project_id: dbAnnotation.project_id,
          type: dbAnnotation.type,
          label: dbAnnotation.label,
          color: dbAnnotation.color,
          label_type_id: dbAnnotation.label_type_id,
          comment: dbAnnotation.comment,
          group_type_id: dbAnnotation.group_type_id,
          data: dbAnnotation.data as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return dbToAnnotation(data as DbAnnotation);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['annotations', fileId, projectId] });
      logActivityEvent({
        userId: variables.userId,
        eventType: "annotate",
        entityType: "annotation",
        entityId: result.id,
        description: `Added "${result.label}" annotation`,
      });
      logAuditEvent({
        userId: variables.userId,
        action: "create_annotation",
        category: "annotation",
        entityType: "annotation",
        entityId: result.id,
        entityName: result.label,
        description: `created "${result.label}" ${result.type} annotation`,
        newValues: { label: result.label, type: result.type, color: result.color },
      });
    },
    onError: (error) => {
      toast.error(`Failed to save annotation: ${error.message}`);
    },
  });

  const updateAnnotation = useMutation({
    mutationFn: async ({ annotation, userId }: { annotation: Annotation; userId: string }) => {
      if (!fileId) throw new Error('No file ID');

      const dbAnnotation = annotationToDb(annotation, fileId, userId, projectId);
      const { data, error } = await supabase
        .from('annotations')
        .update({
          label: dbAnnotation.label,
          color: dbAnnotation.color,
          label_type_id: dbAnnotation.label_type_id,
          comment: dbAnnotation.comment,
          group_type_id: dbAnnotation.group_type_id,
          data: dbAnnotation.data as Json,
        })
        .eq('id', annotation.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Permission denied or annotation not found');
      }
      return dbToAnnotation(data[0] as DbAnnotation);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['annotations', fileId, projectId] });
      logAuditEvent({
        userId: variables.userId,
        action: "update_annotation",
        category: "annotation",
        entityType: "annotation",
        entityId: result.id,
        entityName: result.label,
        description: `updated annotation "${result.label}"`,
        newValues: { label: result.label, color: result.color, comment: result.comment },
      });
    },
    onError: (error) => {
      toast.error(`Failed to update annotation: ${error.message}`);
    },
  });

  const deleteAnnotation = useMutation({
    mutationFn: async (params: string | { annotationId: string; userId: string }) => {
      const annotationId = typeof params === 'string' ? params : params.annotationId;
      const userId = typeof params === 'string' ? undefined : params.userId;

      // Fetch annotation details before deletion for audit trail
      let deletedAnnotation: DbAnnotation | null = null;
      if (userId) {
        const { data } = await supabase
          .from('annotations')
          .select('*')
          .eq('id', annotationId)
          .single();
        deletedAnnotation = data as DbAnnotation | null;
      }

      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('id', annotationId);

      if (error) throw error;

      // Log audit event with annotation details
      if (userId && deletedAnnotation) {
        logAuditEvent({
          userId,
          action: "delete_annotation",
          category: "annotation",
          description: `Deleted "${deletedAnnotation.label}" annotation`,
          entityType: "annotation",
          entityId: annotationId,
          entityName: deletedAnnotation.label,
          oldValues: {
            label: deletedAnnotation.label,
            type: deletedAnnotation.type,
            color: deletedAnnotation.color,
            file_id: deletedAnnotation.file_id,
            project_id: deletedAnnotation.project_id,
            data: deletedAnnotation.data,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', fileId, projectId] });
    },
    onError: (error) => {
      toast.error(`Failed to delete annotation: ${error.message}`);
    },
  });

  const deleteAllAnnotations = useMutation({
    mutationFn: async () => {
      if (!fileId) throw new Error('No file ID');

      let query = supabase
        .from('annotations')
        .delete()
        .eq('file_id', fileId);

      if (projectId) {
        query = query.eq('project_id', projectId);
      } else {
        query = query.is('project_id', null);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', fileId, projectId] });
    },
    onError: (error) => {
      toast.error(`Failed to clear annotations: ${error.message}`);
    },
  });

  console.log("CONVERTED COUNT", annotations.length);

  annotations.forEach(a => {
    console.log("BOX", {
      id: a.id,
      label: a.label,
      type: a.type
    });
  });

  return {
    annotations,
    isLoading,
    error,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    deleteAllAnnotations,
  };
}
