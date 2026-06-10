export type AnnotationTool = 'select' | 'boundingBox' | 'polygon' | 'textHighlight' | 'frameLabel' | 'videoSegment' | 'boundingBox3d';

export type TagColor = "blue" | "green" | "yellow" | "purple" | "pink" | "orange" | "cyan" | "red";

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBoxAnnotation {
  id: string;
  type: 'boundingBox';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: TagColor;
  topicName?: string;
  frameIndex?: number;
  timestamp?: number;
}

export interface PolygonAnnotation {
  id: string;
  type: 'polygon';
  points: Point[];
  label: string;
  color: TagColor;
  topicName?: string;
  frameIndex?: number;
  timestamp?: number;
}

export interface TextHighlightAnnotation {
  id: string;
  type: 'textHighlight';
  startOffset: number;
  endOffset: number;
  text: string;
  label: string;
  color: TagColor;
}

export interface RowAnnotation {
  id: string;
  type: 'rowAnnotation';
  rowIndex: number;
  label: string;
  color: TagColor;
}

export interface AudioRegionAnnotation {
  id: string;
  type: 'audioRegion';
  startTime: number;
  endTime: number;
  transcript: string;
  speaker: string;
  language: string;
  emotion: string;
  label: string;
  color: TagColor;
}

export interface FrameLabelAnnotation {
  id: string;
  type: 'frameLabel';
  topicName: string;
  frameIndex: number;
  timestamp: number;
  label: string;
  color: TagColor;
}

export interface VideoSegmentAnnotation {
  id: string;
  type: 'videoSegment';
  startTime: number;
  endTime: number;
  label: string;
  color: TagColor;
  topicName?: string;
}

export interface BoundingBox3dAnnotation {
  id: string;
  type: 'boundingBox3d';
  // Center of the cuboid in world coordinates
  cx: number;
  cy: number;
  cz: number;
  // Full sizes along each axis
  sx: number;
  sy: number;
  sz: number;
  label: string;
  color: TagColor;
}

export type Annotation = (BoundingBoxAnnotation | PolygonAnnotation | TextHighlightAnnotation | RowAnnotation | AudioRegionAnnotation | FrameLabelAnnotation | VideoSegmentAnnotation | BoundingBox3dAnnotation) & {
  labelTypeId?: string;
  labelTypeName?: string;
  comment?: string;
  groupTypeId?: string;
  groupTypeName?: string;
};

export interface FileTag {
  id: string;
  label: string;
  color: TagColor;
}

export interface FileData {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  tags: FileTag[];
  thumbnail?: string;
  annotations?: Annotation[];
}
