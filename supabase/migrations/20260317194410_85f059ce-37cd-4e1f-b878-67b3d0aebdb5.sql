
-- Pipeline runs table to track execution history and progress
CREATE TABLE public.pipeline_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  started_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pipeline_runs_pipeline_id ON public.pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_started_by ON public.pipeline_runs(started_by);
CREATE INDEX idx_pipeline_runs_status ON public.pipeline_runs(status);

-- Enable RLS
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Users can view their own runs
CREATE POLICY "Users can view own pipeline runs"
  ON public.pipeline_runs FOR SELECT
  TO authenticated
  USING (started_by = auth.uid());

-- Users can create their own runs
CREATE POLICY "Users can create own pipeline runs"
  ON public.pipeline_runs FOR INSERT
  TO authenticated
  WITH CHECK (started_by = auth.uid());

-- Users can update their own runs
CREATE POLICY "Users can update own pipeline runs"
  ON public.pipeline_runs FOR UPDATE
  TO authenticated
  USING (started_by = auth.uid());

-- Managers/admins can view all runs
CREATE POLICY "Managers can view all pipeline runs"
  ON public.pipeline_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
