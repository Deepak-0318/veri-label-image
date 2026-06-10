-- Project label types
CREATE TABLE IF NOT EXISTS public.project_label_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_label_types ENABLE ROW LEVEL SECURITY;

-- Project labels
CREATE TABLE IF NOT EXISTS public.project_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label_type_id uuid REFERENCES public.project_label_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_labels ENABLE ROW LEVEL SECURITY;

-- Project label types RLS
DROP POLICY IF EXISTS "Managers can manage project label types" ON public.project_label_types;
CREATE POLICY "Managers can manage project label types" ON public.project_label_types FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_label_types.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Project owners can manage their label types" ON public.project_label_types;
CREATE POLICY "Project owners can manage their label types" ON public.project_label_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_label_types.project_id AND p.user_id = auth.uid()))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Annotators can view project label types" ON public.project_label_types;
CREATE POLICY "Annotators can view project label types" ON public.project_label_types FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_label_types.project_id AND t.assigned_to = auth.uid()));

-- Project labels RLS
DROP POLICY IF EXISTS "Managers can manage project labels" ON public.project_labels;
CREATE POLICY "Managers can manage project labels" ON public.project_labels FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_labels.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Project owners can manage their labels" ON public.project_labels;
CREATE POLICY "Project owners can manage their labels" ON public.project_labels FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_labels.project_id AND p.user_id = auth.uid()))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Annotators can view project labels" ON public.project_labels;
CREATE POLICY "Annotators can view project labels" ON public.project_labels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_labels.project_id AND t.assigned_to = auth.uid()));

-- Pending invitations
CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'annotator',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org managers can view invitations" ON public.pending_invitations;
CREATE POLICY "Org managers can view invitations" ON public.pending_invitations FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Org managers can create invitations" ON public.pending_invitations;
CREATE POLICY "Org managers can create invitations" ON public.pending_invitations FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Org managers can delete invitations" ON public.pending_invitations;
CREATE POLICY "Org managers can delete invitations" ON public.pending_invitations FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), organization_id) AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users can view own invitations" ON public.pending_invitations;
CREATE POLICY "Users can view own invitations" ON public.pending_invitations FOR SELECT TO authenticated
  USING (email = (SELECT p.email FROM profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "Users can accept own invitations" ON public.pending_invitations;
CREATE POLICY "Users can accept own invitations" ON public.pending_invitations FOR UPDATE TO authenticated
  USING (email = (SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK (email = (SELECT p.email FROM profiles p WHERE p.id = auth.uid()));

-- Transform scripts
CREATE TABLE IF NOT EXISTS public.transform_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  language text NOT NULL DEFAULT 'python',
  script text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transform_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scripts" ON public.transform_scripts;
CREATE POLICY "Users can view own scripts" ON public.transform_scripts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own scripts" ON public.transform_scripts;
CREATE POLICY "Users can create own scripts" ON public.transform_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own scripts" ON public.transform_scripts;
CREATE POLICY "Users can update own scripts" ON public.transform_scripts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own scripts" ON public.transform_scripts;
CREATE POLICY "Users can delete own scripts" ON public.transform_scripts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE TRIGGER update_transform_scripts_updated_at BEFORE UPDATE ON public.transform_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Project flags
CREATE TABLE IF NOT EXISTS public.project_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage project flags" ON public.project_flags;
CREATE POLICY "Managers can manage project flags" ON public.project_flags FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_flags.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Project owners can manage flags" ON public.project_flags;
CREATE POLICY "Project owners can manage flags" ON public.project_flags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_flags.project_id AND p.user_id = auth.uid()))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Annotators can view project flags" ON public.project_flags;
CREATE POLICY "Annotators can view project flags" ON public.project_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_flags.project_id AND t.assigned_to = auth.uid()));

DROP POLICY IF EXISTS "QC can view project flags" ON public.project_flags;
CREATE POLICY "QC can view project flags" ON public.project_flags FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_flags.project_id AND t.assigned_to = auth.uid()));

-- Annotation flags junction
CREATE TABLE IF NOT EXISTS public.annotation_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id uuid NOT NULL REFERENCES public.annotations(id) ON DELETE CASCADE,
  flag_id uuid NOT NULL REFERENCES public.project_flags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(annotation_id, flag_id)
);
ALTER TABLE public.annotation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own annotation flags" ON public.annotation_flags;
CREATE POLICY "Users can manage own annotation flags" ON public.annotation_flags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM annotations a WHERE a.id = annotation_flags.annotation_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM annotations a WHERE a.id = annotation_flags.annotation_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Managers can manage org annotation flags" ON public.annotation_flags;
CREATE POLICY "Managers can manage org annotation flags" ON public.annotation_flags FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM annotations a JOIN projects p ON p.id = a.project_id WHERE a.id = annotation_flags.annotation_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM annotations a JOIN projects p ON p.id = a.project_id WHERE a.id = annotation_flags.annotation_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())));

DROP POLICY IF EXISTS "QC can manage annotation flags" ON public.annotation_flags;
CREATE POLICY "QC can manage annotation flags" ON public.annotation_flags FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM annotations a JOIN sub_tasks st ON st.file_id = a.file_id JOIN tasks t ON t.id = st.task_id WHERE a.id = annotation_flags.annotation_id AND t.qa_assigned_to = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM annotations a JOIN sub_tasks st ON st.file_id = a.file_id JOIN tasks t ON t.id = st.task_id WHERE a.id = annotation_flags.annotation_id AND t.qa_assigned_to = auth.uid()));

DROP POLICY IF EXISTS "Annotators can view annotation flags" ON public.annotation_flags;
CREATE POLICY "Annotators can view annotation flags" ON public.annotation_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM annotations a JOIN sub_tasks st ON st.file_id = a.file_id JOIN tasks t ON t.id = st.task_id WHERE a.id = annotation_flags.annotation_id AND t.assigned_to = auth.uid()));

-- Project group types
CREATE TABLE IF NOT EXISTS public.project_group_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_group_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage group types" ON public.project_group_types;
CREATE POLICY "Managers can manage group types" ON public.project_group_types FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_group_types.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Project owners can manage group types" ON public.project_group_types;
CREATE POLICY "Project owners can manage group types" ON public.project_group_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_group_types.project_id AND p.user_id = auth.uid()))
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Annotators can view group types" ON public.project_group_types;
CREATE POLICY "Annotators can view group types" ON public.project_group_types FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_group_types.project_id AND t.assigned_to = auth.uid()));

DROP POLICY IF EXISTS "QC can view group types" ON public.project_group_types;
CREATE POLICY "QC can view group types" ON public.project_group_types FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_group_types.project_id AND t.assigned_to = auth.uid()));

-- Add project columns
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS data_type text NOT NULL DEFAULT 'image';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS annotation_type text NOT NULL DEFAULT 'bounding_box';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS guidelines text;

-- Type constraint on annotations
ALTER TABLE public.annotations DROP CONSTRAINT IF EXISTS annotations_type_check;
ALTER TABLE public.annotations ADD CONSTRAINT annotations_type_check CHECK (type IN ('boundingBox', 'polygon', 'textHighlight', 'rowAnnotation', 'audioRegion', 'mcapFrame', 'frameLabel', 'videoSegment'));

-- Task progress sync trigger
CREATE OR REPLACE FUNCTION public.sync_task_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _task_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN _task_id := OLD.task_id; ELSE _task_id := NEW.task_id; END IF;
  UPDATE public.tasks SET
    total_items = (SELECT COUNT(*) FROM public.sub_tasks WHERE task_id = _task_id),
    completed_items = (SELECT COUNT(*) FROM public.sub_tasks WHERE task_id = _task_id AND status = 'completed'),
    updated_at = now()
  WHERE id = _task_id;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER sync_task_progress_trigger AFTER INSERT OR UPDATE OR DELETE ON public.sub_tasks FOR EACH ROW EXECUTE FUNCTION public.sync_task_progress();