
-- Project flags table
CREATE TABLE public.project_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_flags ENABLE ROW LEVEL SECURITY;

-- RLS: project owners
CREATE POLICY "Project owners can manage flags" ON public.project_flags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_flags.project_id AND p.user_id = auth.uid()))
  WITH CHECK (created_by = auth.uid());

-- RLS: managers
CREATE POLICY "Managers can manage org flags" ON public.project_flags
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')) AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_flags.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')) AND created_by = auth.uid());

-- RLS: annotators can view
CREATE POLICY "Annotators can view project flags" ON public.project_flags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_flags.project_id AND t.assigned_to = auth.uid()));

-- RLS: QC can view
CREATE POLICY "QC can view project flags" ON public.project_flags
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'qc') AND EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_flags.project_id AND t.assigned_to = auth.uid()));

-- Annotation flags junction table
CREATE TABLE public.annotation_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id uuid NOT NULL REFERENCES public.annotations(id) ON DELETE CASCADE,
  flag_id uuid NOT NULL REFERENCES public.project_flags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(annotation_id, flag_id)
);

ALTER TABLE public.annotation_flags ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage flags on their own annotations
CREATE POLICY "Users can manage own annotation flags" ON public.annotation_flags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM annotations a WHERE a.id = annotation_flags.annotation_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM annotations a WHERE a.id = annotation_flags.annotation_id AND a.user_id = auth.uid()));

-- RLS: managers can manage org annotation flags
CREATE POLICY "Managers can manage org annotation flags" ON public.annotation_flags
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')) AND EXISTS (SELECT 1 FROM annotations a JOIN projects p ON p.id = a.project_id WHERE a.id = annotation_flags.annotation_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')) AND EXISTS (SELECT 1 FROM annotations a JOIN projects p ON p.id = a.project_id WHERE a.id = annotation_flags.annotation_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())));

-- RLS: QC can manage annotation flags on assigned files
CREATE POLICY "QC can manage annotation flags" ON public.annotation_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'qc') AND EXISTS (SELECT 1 FROM annotations a JOIN sub_tasks st ON st.file_id = a.file_id JOIN tasks t ON t.id = st.task_id WHERE a.id = annotation_flags.annotation_id AND t.qa_assigned_to = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'qc') AND EXISTS (SELECT 1 FROM annotations a JOIN sub_tasks st ON st.file_id = a.file_id JOIN tasks t ON t.id = st.task_id WHERE a.id = annotation_flags.annotation_id AND t.qa_assigned_to = auth.uid()));

-- RLS: annotators can view annotation flags on their assignments
CREATE POLICY "Annotators can view annotation flags" ON public.annotation_flags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM annotations a JOIN sub_tasks st ON st.file_id = a.file_id JOIN tasks t ON t.id = st.task_id WHERE a.id = annotation_flags.annotation_id AND t.assigned_to = auth.uid()));
