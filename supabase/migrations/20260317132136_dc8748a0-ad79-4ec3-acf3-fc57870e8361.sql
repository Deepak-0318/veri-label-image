
-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'annotator');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- 4. Project objectives table
CREATE TABLE public.project_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  objective_type text NOT NULL DEFAULT 'classification',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project objectives" ON public.project_objectives
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- 5. Tasks table
CREATE TABLE public.tasks (
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

CREATE POLICY "Managers can manage tasks" ON public.tasks
  FOR ALL USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Annotators can view assigned tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

-- 6. Sub-tasks table
CREATE TABLE public.sub_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage sub_tasks" ON public.sub_tasks
  FOR ALL USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Annotators can view assigned sub_tasks" ON public.sub_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND assigned_to = auth.uid())
  );

CREATE POLICY "Annotators can update assigned sub_tasks" ON public.sub_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND assigned_to = auth.uid())
  );

-- 7. Segments table
CREATE TABLE public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
  layer text NOT NULL DEFAULT 'default',
  start_time float,
  end_time float,
  start_offset integer,
  end_offset integer,
  label text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own file segments" ON public.segments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.files WHERE id = file_id AND user_id = auth.uid())
  );

CREATE POLICY "Managers can manage all segments" ON public.segments
  FOR ALL USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
  );

-- 8. Pipelines table
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  pipeline_type text NOT NULL DEFAULT 'auto_tagging',
  config jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage pipelines" ON public.pipelines
  FOR ALL USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can view project pipelines" ON public.pipelines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- 9. Add updated_at triggers
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sub_tasks_updated_at BEFORE UPDATE ON public.sub_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
