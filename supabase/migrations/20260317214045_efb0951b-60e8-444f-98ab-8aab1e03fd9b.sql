
-- Datasets table
CREATE TABLE public.datasets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Junction table for dataset-file associations
CREATE TABLE public.dataset_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, file_id)
);

-- Updated_at trigger for datasets
CREATE TRIGGER update_datasets_updated_at
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for datasets
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own datasets" ON public.datasets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own datasets" ON public.datasets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own datasets" ON public.datasets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own datasets" ON public.datasets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS for dataset_files
ALTER TABLE public.dataset_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dataset files" ON public.dataset_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.datasets WHERE datasets.id = dataset_files.dataset_id AND datasets.user_id = auth.uid()));
CREATE POLICY "Users can insert own dataset files" ON public.dataset_files
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.datasets WHERE datasets.id = dataset_files.dataset_id AND datasets.user_id = auth.uid()));
CREATE POLICY "Users can delete own dataset files" ON public.dataset_files
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.datasets WHERE datasets.id = dataset_files.dataset_id AND datasets.user_id = auth.uid()));
