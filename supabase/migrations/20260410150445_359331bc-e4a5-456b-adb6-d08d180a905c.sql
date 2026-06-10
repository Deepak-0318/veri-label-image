-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size BIGINT,
  thumbnail_url TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create annotations table (no CHECK constraint - will add final one later)
CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create labels table
CREATE TABLE IF NOT EXISTS public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
CREATE POLICY "Users can view their own files" ON public.files FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own files" ON public.files;
CREATE POLICY "Users can create their own files" ON public.files FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
CREATE POLICY "Users can update their own files" ON public.files FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;
CREATE POLICY "Users can delete their own files" ON public.files FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own annotations" ON public.annotations;
CREATE POLICY "Users can view their own annotations" ON public.annotations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own annotations" ON public.annotations;
CREATE POLICY "Users can create their own annotations" ON public.annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own annotations" ON public.annotations;
CREATE POLICY "Users can update their own annotations" ON public.annotations FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own annotations" ON public.annotations;
CREATE POLICY "Users can delete their own annotations" ON public.annotations FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own labels" ON public.labels;
CREATE POLICY "Users can view their own labels" ON public.labels FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own labels" ON public.labels;
CREATE POLICY "Users can create their own labels" ON public.labels FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own labels" ON public.labels;
CREATE POLICY "Users can update their own labels" ON public.labels FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own labels" ON public.labels;
CREATE POLICY "Users can delete their own labels" ON public.labels FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_file_id ON public.annotations(file_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_labels_user_id ON public.labels(user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files" ON storage.objects FOR SELECT USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files" ON storage.objects FOR UPDATE USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files" ON storage.objects FOR DELETE USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE OR REPLACE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.files ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_files_project_id ON public.files(project_id);

-- Exports table
CREATE TABLE IF NOT EXISTS public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  format text NOT NULL DEFAULT 'json',
  file_count integer NOT NULL DEFAULT 0,
  annotation_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  download_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own exports" ON public.exports;
CREATE POLICY "Users can view their own exports" ON public.exports FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own exports" ON public.exports;
CREATE POLICY "Users can create their own exports" ON public.exports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own exports" ON public.exports;
CREATE POLICY "Users can delete their own exports" ON public.exports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Extend app_role enum with additional values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'annotator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'qc';

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE OR REPLACE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sub tasks
CREATE TABLE IF NOT EXISTS public.sub_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sub_tasks_task_id ON public.sub_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_file_id ON public.sub_tasks(file_id);
CREATE OR REPLACE TRIGGER update_sub_tasks_updated_at BEFORE UPDATE ON public.sub_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Segments table
CREATE TABLE IF NOT EXISTS public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
  speaker text,
  start_time float NOT NULL,
  end_time float NOT NULL,
  text text NOT NULL,
  language text,
  emotion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_segments_file_id ON public.segments(file_id);

-- Pipelines table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pipelines_created_by ON public.pipelines(created_by);
CREATE OR REPLACE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON public.pipelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project objectives
CREATE TABLE IF NOT EXISTS public.project_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  objective_type text NOT NULL DEFAULT 'classification',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_objectives ENABLE ROW LEVEL SECURITY;

-- Add annotation columns
ALTER TABLE public.annotations ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.annotations ADD COLUMN IF NOT EXISTS label_type_id uuid;
ALTER TABLE public.annotations ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.annotations ADD COLUMN IF NOT EXISTS qc_status text;
ALTER TABLE public.annotations ADD COLUMN IF NOT EXISTS qc_comment text;
ALTER TABLE public.annotations ADD COLUMN IF NOT EXISTS group_type_id uuid;
CREATE INDEX IF NOT EXISTS idx_annotations_project_id ON public.annotations(project_id);

-- Add task columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS qa_assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'annotation';