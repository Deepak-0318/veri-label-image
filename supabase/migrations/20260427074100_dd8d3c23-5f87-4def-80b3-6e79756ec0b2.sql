-- 1. project_variables: per-project custom parameter definitions
CREATE TABLE public.project_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  variable_type text NOT NULL CHECK (variable_type IN ('number','text','single_select','multi_select')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  min_value numeric,
  max_value numeric,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_variables_project ON public.project_variables(project_id);

ALTER TABLE public.project_variables ENABLE ROW LEVEL SECURITY;

-- Project owner (legacy single-user projects)
CREATE POLICY "Project owners can manage variables"
ON public.project_variables
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_variables.project_id AND p.user_id = auth.uid()))
WITH CHECK (created_by = auth.uid());

-- Managers/Admins in same org
CREATE POLICY "Managers can manage project variables"
ON public.project_variables
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_variables.project_id
      AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND created_by = auth.uid()
);

-- Annotators with a task on this project
CREATE POLICY "Annotators can view project variables"
ON public.project_variables
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.project_id = project_variables.project_id AND t.assigned_to = auth.uid()
  )
);

-- QC with a task on this project
CREATE POLICY "QC can view project variables"
ON public.project_variables
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.project_id = project_variables.project_id AND t.qa_assigned_to = auth.uid()
  )
);

CREATE TRIGGER trg_project_variables_updated
BEFORE UPDATE ON public.project_variables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. annotation_variable_values: per-annotation values
CREATE TABLE public.annotation_variable_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid NOT NULL REFERENCES public.annotations(id) ON DELETE CASCADE,
  variable_id uuid NOT NULL REFERENCES public.project_variables(id) ON DELETE CASCADE,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annotation_id, variable_id)
);

CREATE INDEX idx_annotation_variable_values_annotation ON public.annotation_variable_values(annotation_id);
CREATE INDEX idx_annotation_variable_values_variable ON public.annotation_variable_values(variable_id);

ALTER TABLE public.annotation_variable_values ENABLE ROW LEVEL SECURITY;

-- Annotation owner can manage
CREATE POLICY "Users can manage own annotation variable values"
ON public.annotation_variable_values
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.annotations a WHERE a.id = annotation_variable_values.annotation_id AND a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.annotations a WHERE a.id = annotation_variable_values.annotation_id AND a.user_id = auth.uid()));

-- Assigned annotators can manage values for their task's annotations
CREATE POLICY "Annotators can manage assigned annotation variable values"
ON public.annotation_variable_values
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.annotations a
    JOIN public.sub_tasks st ON st.file_id = a.file_id
    JOIN public.tasks t ON t.id = st.task_id
    WHERE a.id = annotation_variable_values.annotation_id
      AND t.assigned_to = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.annotations a
    JOIN public.sub_tasks st ON st.file_id = a.file_id
    JOIN public.tasks t ON t.id = st.task_id
    WHERE a.id = annotation_variable_values.annotation_id
      AND t.assigned_to = auth.uid()
  )
);

-- QC can manage values for assigned review tasks
CREATE POLICY "QC can manage assigned annotation variable values"
ON public.annotation_variable_values
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.annotations a
    JOIN public.sub_tasks st ON st.file_id = a.file_id
    JOIN public.tasks t ON t.id = st.task_id
    WHERE a.id = annotation_variable_values.annotation_id
      AND t.qa_assigned_to = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.annotations a
    JOIN public.sub_tasks st ON st.file_id = a.file_id
    JOIN public.tasks t ON t.id = st.task_id
    WHERE a.id = annotation_variable_values.annotation_id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- Managers/Admins in same org can manage
CREATE POLICY "Managers can manage org annotation variable values"
ON public.annotation_variable_values
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.annotations a
    JOIN public.projects p ON p.id = a.project_id
    WHERE a.id = annotation_variable_values.annotation_id
      AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.annotations a
    JOIN public.projects p ON p.id = a.project_id
    WHERE a.id = annotation_variable_values.annotation_id
      AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
  )
);

CREATE TRIGGER trg_annotation_variable_values_updated
BEFORE UPDATE ON public.annotation_variable_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
