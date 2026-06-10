ALTER TABLE public.files
ADD COLUMN external_url text DEFAULT NULL,
ADD COLUMN storage_mode text NOT NULL DEFAULT 'copy';