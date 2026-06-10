export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface PipelineResult {
  success: boolean;
  pipelineId?: string;
  results: {
    node: string;
    annotations?: DetectionResult[];
  }[];
}