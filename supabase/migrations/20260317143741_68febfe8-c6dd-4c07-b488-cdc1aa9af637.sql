
ALTER TABLE public.projects
ADD COLUMN data_type text NOT NULL DEFAULT 'text',
ADD COLUMN annotation_type text NOT NULL DEFAULT 'classification',
ADD COLUMN guidelines text;
