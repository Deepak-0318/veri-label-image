import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Annotation, BoundingBoxAnnotation, PolygonAnnotation, TextHighlightAnnotation, RowAnnotation, AudioRegionAnnotation, FrameLabelAnnotation, VideoSegmentAnnotation, BoundingBox3dAnnotation, TagColor, PointAnnotation, PolylineAnnotation, KeypointAnnotation, Point } from "@/types/annotation";
import { toast } from "sonner";
import { logActivityEvent } from "@/services/activityLogger";
import { logAuditEvent } from "@/services/auditLogger";
import { Json } from "@/integrations/supabase/types";
import { AnnotationApi } from "@/services/apiClient";

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
  group_type_id: string | null;
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
  } else if (db.type === 'point') {
    const data = typeof db.data === 'string' ? JSON.parse(db.data) : db.data as { x: number; y: number };
    return {
      ...base,
      type: 'point',
      x: data.x,
      y: data.y,
    } as PointAnnotation;
  } else if (db.type === 'polyline') {
    const data = typeof db.data === 'string' ? JSON.parse(db.data) : db.data as { points: Point[] };
    return {
      ...base,
      type: 'polyline',
      points: data.points,
    } as PolylineAnnotation;
  } else if (db.type === 'keypoint') {
    const data = typeof db.data === 'string' ? JSON.parse(db.data) : db.data as { x: number; y: number };
    return {
      ...base,
      type: 'keypoint',
      x: data.x,
      y: data.y,
    } as KeypointAnnotation;
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
  } else if (annotation.type === 'point') {
    data = {
      x: annotation.x,
      y: annotation.y,
    };
  } else if (annotation.type === 'polyline') {
    data = {
      points: annotation.points,
    };
  } else if (annotation.type === 'keypoint') {
    data = {
      x: annotation.x,
      y: annotation.y,
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

const getToken = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageKey = `sb-${projectId}-auth-token`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.access_token;
  } catch {
    return null;
  }
};

export function useAnnotations(fileId: string | undefined, projectId?: string | undefined) {
  const queryClient = useQueryClient();

  const { data: annotations = [], isLoading, error } = useQuery({
    queryKey: ['annotations', fileId, projectId],
    queryFn: async () => {
      if (!fileId) return [];
      const token = getToken();
      if (!token) return [];

      const data = await AnnotationApi.getAnnotations(fileId, token);
      const converted = (data as any[]).map((db: any) => {
        const normalizedDb: DbAnnotation = {
          id: db.id,
          file_id: db.fileId || db.file_id,
          user_id: db.userId || db.user_id,
          project_id: db.projectId || db.project_id,
          type: db.type,
          label: db.label,
          color: db.color,
          label_type_id: db.labelTypeId || db.label_type_id,
          group_type_id: db.groupTypeId || db.group_type_id,
          comment: db.comment,
          qc_status: db.qcStatus || db.qc_status,
          qc_comment: db.qcComment || db.qc_comment,
          data: db.data,
          created_at: db.createdAt || db.created_at,
          updated_at: db.updatedAt || db.updated_at,
        };
        return dbToAnnotation(normalizedDb);
      });
      return converted;
    },
    enabled: !!fileId,
  });

  const createAnnotation = useMutation({
    mutationFn: async ({ annotation, userId }: { annotation: Annotation; userId: string }) => {
      if (!fileId) throw new Error('No file ID');
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const dbAnnotation = annotationToDb(annotation, fileId, userId, projectId);
      const payload = {
        id: dbAnnotation.id,
        fileId: dbAnnotation.file_id,
        userId: dbAnnotation.user_id,
        projectId: dbAnnotation.project_id,
        type: dbAnnotation.type,
        label: dbAnnotation.label,
        color: dbAnnotation.color,
        labelTypeId: dbAnnotation.label_type_id,
        groupTypeId: dbAnnotation.group_type_id,
        comment: dbAnnotation.comment,
        data: dbAnnotation.data,
      };

      const res = await AnnotationApi.create(payload as any, token);
      const apiRes = res as any;
      const normalizedRes: DbAnnotation = {
        id: apiRes.id,
        file_id: apiRes.fileId || apiRes.file_id,
        user_id: apiRes.userId || apiRes.user_id,
        project_id: apiRes.projectId || apiRes.project_id,
        type: apiRes.type,
        label: apiRes.label,
        color: apiRes.color,
        label_type_id: apiRes.labelTypeId || apiRes.label_type_id,
        group_type_id: apiRes.groupTypeId || apiRes.group_type_id,
        comment: apiRes.comment,
        qc_status: apiRes.qcStatus || apiRes.qc_status,
        qc_comment: apiRes.qcComment || apiRes.qc_comment,
        data: apiRes.data,
        created_at: apiRes.createdAt || apiRes.created_at,
        updated_at: apiRes.updatedAt || apiRes.updated_at,
      };
      return dbToAnnotation(normalizedRes);
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
    },
    onError: (error) => {
      toast.error(`Failed to save annotation: ${error.message}`);
    },
  });

  const updateAnnotation = useMutation({
    mutationFn: async ({ annotation, userId }: { annotation: Annotation; userId: string }) => {
      if (!fileId) throw new Error('No file ID');
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const dbAnnotation = annotationToDb(annotation, fileId, userId, projectId);
      const patch = {
        label: dbAnnotation.label,
        color: dbAnnotation.color,
        labelTypeId: dbAnnotation.label_type_id,
        comment: dbAnnotation.comment,
        groupTypeId: dbAnnotation.group_type_id,
        data: dbAnnotation.data,
      };

      const res = await AnnotationApi.update(annotation.id, patch as any, token);
      const apiRes = res as any;
      const normalizedRes: DbAnnotation = {
        id: apiRes.id,
        file_id: apiRes.fileId || apiRes.file_id,
        user_id: apiRes.userId || apiRes.user_id,
        project_id: apiRes.projectId || apiRes.project_id,
        type: apiRes.type,
        label: apiRes.label,
        color: apiRes.color,
        label_type_id: apiRes.labelTypeId || apiRes.label_type_id,
        group_type_id: apiRes.groupTypeId || apiRes.group_type_id,
        comment: apiRes.comment,
        qc_status: apiRes.qcStatus || apiRes.qc_status,
        qc_comment: apiRes.qcComment || apiRes.qc_comment,
        data: apiRes.data,
        created_at: apiRes.createdAt || apiRes.created_at,
        updated_at: apiRes.updatedAt || apiRes.updated_at,
      };
      return dbToAnnotation(normalizedRes);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['annotations', fileId, projectId] });
    },
    onError: (error) => {
      toast.error(`Failed to update annotation: ${error.message}`);
    },
  });

  const deleteAnnotation = useMutation({
    mutationFn: async (params: string | { annotationId: string; userId: string }) => {
      const annotationId = typeof params === 'string' ? params : params.annotationId;
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      await AnnotationApi.delete(annotationId, token);
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
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const data = await AnnotationApi.getAnnotations(fileId, token);
      const ids = data.map((a) => a.id);
      if (ids.length > 0) {
        await AnnotationApi.batchDelete(ids, token);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', fileId, projectId] });
    },
    onError: (error) => {
      toast.error(`Failed to clear annotations: ${error.message}`);
    },
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
