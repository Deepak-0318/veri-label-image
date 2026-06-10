-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Organization members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id)
$$;

-- Organization policies
DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;
CREATE POLICY "Org members can view their org" ON public.organizations FOR SELECT TO authenticated USING (is_org_member(auth.uid(), id));
DROP POLICY IF EXISTS "Org owners can update" ON public.organizations;
CREATE POLICY "Org owners can update" ON public.organizations FOR UPDATE TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
CREATE POLICY "Authenticated users can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- Organization members policies
DROP POLICY IF EXISTS "Org members can view members" ON public.organization_members;
CREATE POLICY "Org members can view members" ON public.organization_members FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org owners can manage members" ON public.organization_members;
CREATE POLICY "Org owners can manage members" ON public.organization_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organizations WHERE id = organization_id AND owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users can add themselves" ON public.organization_members;
CREATE POLICY "Users can add themselves" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Add org_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Files extra columns
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS folder text;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS storage_mode text NOT NULL DEFAULT 'supabase';
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS external_url text;

-- Datasets
CREATE TABLE IF NOT EXISTS public.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can view own datasets" ON public.datasets;
CREATE POLICY "Users can view own datasets" ON public.datasets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create datasets" ON public.datasets;
CREATE POLICY "Users can create datasets" ON public.datasets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own datasets" ON public.datasets;
CREATE POLICY "Users can update own datasets" ON public.datasets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own datasets" ON public.datasets;
CREATE POLICY "Users can delete own datasets" ON public.datasets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Dataset files junction
CREATE TABLE IF NOT EXISTS public.dataset_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, file_id)
);
ALTER TABLE public.dataset_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dataset files" ON public.dataset_files;
CREATE POLICY "Users can view own dataset files" ON public.dataset_files FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage own dataset files" ON public.dataset_files;
CREATE POLICY "Users can manage own dataset files" ON public.dataset_files FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM datasets d WHERE d.id = dataset_id AND d.user_id = auth.uid()));

-- Activity events
CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  project_id UUID,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON public.activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_project_id ON public.activity_events (project_id, created_at DESC);

DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_events;
CREATE POLICY "Users can view own activity" ON public.activity_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own activity" ON public.activity_events;
CREATE POLICY "Users can create own activity" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own activity" ON public.activity_events;
CREATE POLICY "Users can delete own activity" ON public.activity_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  entity_type text,
  entity_id text,
  entity_name text,
  description text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);

DROP POLICY IF EXISTS "Users can view org audit logs" ON public.audit_logs;
CREATE POLICY "Users can view org audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (organization_id = get_user_org_id(auth.uid()) OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users can create audit logs" ON public.audit_logs;
CREATE POLICY "Users can create audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Pipeline runs
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
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
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_id ON public.pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_by ON public.pipeline_runs(started_by);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON public.pipeline_runs(status);

DROP POLICY IF EXISTS "Users can view own pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Users can view own pipeline runs" ON public.pipeline_runs FOR SELECT TO authenticated USING (started_by = auth.uid());
DROP POLICY IF EXISTS "Users can create own pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Users can create own pipeline runs" ON public.pipeline_runs FOR INSERT TO authenticated WITH CHECK (started_by = auth.uid());
DROP POLICY IF EXISTS "Users can update own pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Users can update own pipeline runs" ON public.pipeline_runs FOR UPDATE TO authenticated USING (started_by = auth.uid());
DROP POLICY IF EXISTS "Managers can view all pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Managers can view all pipeline runs" ON public.pipeline_runs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_runs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pipeline block templates
CREATE TABLE IF NOT EXISTS public.pipeline_block_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  block_type text NOT NULL DEFAULT 'custom',
  description text,
  icon text NOT NULL DEFAULT 'Zap',
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  script text,
  language text NOT NULL DEFAULT 'python',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_block_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view system blocks" ON public.pipeline_block_templates;
CREATE POLICY "Anyone can view system blocks" ON public.pipeline_block_templates FOR SELECT TO authenticated USING (is_system = true);
DROP POLICY IF EXISTS "Users can view own blocks" ON public.pipeline_block_templates;
CREATE POLICY "Users can view own blocks" ON public.pipeline_block_templates FOR SELECT TO authenticated USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Users can create blocks" ON public.pipeline_block_templates;
CREATE POLICY "Users can create blocks" ON public.pipeline_block_templates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "Users can update own blocks" ON public.pipeline_block_templates;
CREATE POLICY "Users can update own blocks" ON public.pipeline_block_templates FOR UPDATE TO authenticated USING (created_by = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "Users can delete own blocks" ON public.pipeline_block_templates;
CREATE POLICY "Users can delete own blocks" ON public.pipeline_block_templates FOR DELETE TO authenticated USING (created_by = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "Admins can manage all blocks" ON public.pipeline_block_templates;
CREATE POLICY "Admins can manage all blocks" ON public.pipeline_block_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER update_pipeline_block_templates_updated_at BEFORE UPDATE ON public.pipeline_block_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed system blocks
INSERT INTO public.pipeline_block_templates (name, category, block_type, description, icon, default_config, is_system) VALUES
  ('Whisper Transcription', 'ai', 'ai', 'Speech-to-text transcription using OpenAI Whisper', 'Brain', '{"model": "whisper", "task": "transcription"}'::jsonb, true),
  ('Speaker Diarization', 'ai', 'ai', 'Identify and separate speakers in audio', 'Brain', '{"model": "pyannote", "task": "diarization"}'::jsonb, true),
  ('Emotion Recognition', 'ai', 'ai', 'Detect emotions in speech or text', 'Brain', '{"model": "emotion", "task": "emotion_recognition"}'::jsonb, true),
  ('Sentiment Analysis', 'ai', 'ai', 'Analyze text sentiment', 'Brain', '{"model": "sentiment", "task": "sentiment_analysis"}'::jsonb, true),
  ('NER Tagging', 'ai', 'ai', 'Named entity recognition', 'Brain', '{"model": "ner", "task": "entity_recognition"}'::jsonb, true),
  ('Filter', 'transform', 'function', 'Filter data based on conditions', 'Code', '{"function": "filter", "params": {}}'::jsonb, true),
  ('Map', 'transform', 'function', 'Transform each item', 'Code', '{"function": "map", "params": {}}'::jsonb, true),
  ('Merge', 'transform', 'function', 'Combine multiple data sources', 'Code', '{"function": "merge", "params": {}}'::jsonb, true),
  ('Split', 'transform', 'function', 'Split data into streams', 'Code', '{"function": "split", "params": {}}'::jsonb, true),
  ('If/Else', 'condition', 'logical', 'Branch pipeline based on condition', 'GitBranch', '{"condition": "", "trueBranch": "", "falseBranch": ""}'::jsonb, true),
  ('Switch', 'condition', 'logical', 'Multi-way branch', 'GitBranch', '{"field": "", "cases": {}}'::jsonb, true),
  ('Custom Python Block', 'custom', 'custom', 'User-defined processing logic', 'Zap', '{"script": "def process(data):\n    return data"}'::jsonb, true),
  ('File Input', 'io', 'io', 'Read files from project', 'Download', '{"source": "project", "file_type": "any"}'::jsonb, true),
  ('File Output', 'io', 'io', 'Write results to storage', 'Upload', '{"destination": "project", "format": "json"}'::jsonb, true),
  ('Data Source', 'io', 'io', 'Connect to external data source', 'Database', '{"source_type": "database", "connection": ""}'::jsonb, true),
  ('Export Output', 'io', 'io', 'Export pipeline results', 'FileOutput', '{"format": "csv", "destination": "download"}'::jsonb, true),
  ('File Read', 'operations', 'function', 'Read and parse file contents', 'FileText', '{"file_type": "auto", "encoding": "utf-8"}'::jsonb, true),
  ('API Call', 'operations', 'function', 'Make HTTP requests', 'Globe', '{"method": "GET", "url": "", "headers": {}, "body": ""}'::jsonb, true),
  ('Batch Process', 'operations', 'function', 'Process items in batches', 'Layers', '{"batch_size": 10, "parallel": false}'::jsonb, true),
  ('Delay', 'operations', 'function', 'Add a timed delay', 'Clock', '{"delay_ms": 1000}'::jsonb, true),
  ('Logger', 'operations', 'function', 'Log data for debugging', 'Terminal', '{"level": "info", "format": "json"}'::jsonb, true),
  ('Retry', 'operations', 'function', 'Retry failed operations', 'RefreshCw', '{"max_retries": 3, "backoff_ms": 1000}'::jsonb, true),
  ('LLM', 'ai', 'ai', 'Large Language Model for text tasks', 'MessageSquare', '{"provider": "openai", "model": "gpt-4", "temperature": 0.7}'::jsonb, true),
  ('Agentic AI', 'ai', 'ai', 'Autonomous AI agent for multi-step tasks', 'Bot', '{"provider": "openai", "model": "gpt-4", "tools": [], "max_iterations": 10}'::jsonb, true);