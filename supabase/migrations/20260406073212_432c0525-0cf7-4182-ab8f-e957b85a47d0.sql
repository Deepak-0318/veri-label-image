ALTER TABLE public.annotations 
ADD COLUMN qc_status text DEFAULT NULL,
ADD COLUMN qc_comment text DEFAULT NULL;