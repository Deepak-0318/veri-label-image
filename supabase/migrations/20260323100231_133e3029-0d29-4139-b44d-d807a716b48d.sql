ALTER TABLE public.annotations
  DROP CONSTRAINT IF EXISTS annotations_type_check;

ALTER TABLE public.annotations
  ADD CONSTRAINT annotations_type_check
  CHECK (type IN ('boundingBox', 'polygon', 'textHighlight', 'rowAnnotation', 'audioRegion', 'mcapFrame'));