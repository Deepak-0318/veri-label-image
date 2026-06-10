
CREATE TABLE public.project_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_flags ENABLE ROW LEVEL SECURITY;

-- Managers/admins can fully manage flags for org projects
CREATE POLICY "Managers can manage project flags"
  ON public.project_flags FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_flags.project_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND created_by = auth.uid()
  );

-- Project owners can manage their flags
CREATE POLICY "Project owners can manage flags"
  ON public.project_flags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_flags.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (created_by = auth.uid());

-- Annotators can view flags for projects they have tasks in
CREATE POLICY "Annotators can view project flags"
  ON public.project_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.project_id = project_flags.project_id AND t.assigned_to = auth.uid()
    )
  );

-- QC can view project flags
CREATE POLICY "QC can view project flags"
  ON public.project_flags FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'qc'::app_role)
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.project_id = project_flags.project_id AND t.assigned_to = auth.uid()
    )
  );
