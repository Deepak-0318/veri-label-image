
-- Project-specific label types
CREATE TABLE public.project_label_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project-specific labels (linked to a label type)
CREATE TABLE public.project_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label_type_id uuid NOT NULL REFERENCES public.project_label_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add label_type_id and comment to annotations
ALTER TABLE public.annotations
  ADD COLUMN label_type_id uuid REFERENCES public.project_label_types(id) ON DELETE SET NULL,
  ADD COLUMN comment text;

-- RLS for project_label_types
ALTER TABLE public.project_label_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage project label types"
  ON public.project_label_types FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_label_types.project_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND created_by = auth.uid()
  );

CREATE POLICY "Project owners can manage their label types"
  ON public.project_label_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_label_types.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Annotators can view project label types"
  ON public.project_label_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.project_id = project_label_types.project_id
        AND t.assigned_to = auth.uid()
    )
  );

-- RLS for project_labels
ALTER TABLE public.project_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage project labels"
  ON public.project_labels FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_labels.project_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND created_by = auth.uid()
  );

CREATE POLICY "Project owners can manage their labels"
  ON public.project_labels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_labels.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Annotators can view project labels"
  ON public.project_labels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.project_id = project_labels.project_id
        AND t.assigned_to = auth.uid()
    )
  );
