ALTER TABLE public.annotations ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX idx_annotations_project_file ON public.annotations(project_id, file_id);