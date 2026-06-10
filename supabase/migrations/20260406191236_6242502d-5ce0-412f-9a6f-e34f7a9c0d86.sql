-- Drop the existing check constraint on the annotations.type column
ALTER TABLE public.annotations DROP CONSTRAINT IF EXISTS annotations_type_check;

-- Re-create it with videoSegment included
ALTER TABLE public.annotations ADD CONSTRAINT annotations_type_check
  CHECK (type IN ('boundingBox', 'polygon', 'textHighlight', 'rowAnnotation', 'audioRegion', 'frameLabel', 'videoSegment'));