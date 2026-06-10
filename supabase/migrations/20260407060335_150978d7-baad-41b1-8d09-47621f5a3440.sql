
CREATE TABLE public.annotation_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id uuid NOT NULL REFERENCES public.annotations(id) ON DELETE CASCADE,
  flag_id uuid NOT NULL REFERENCES public.project_flags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (annotation_id, flag_id)
);

ALTER TABLE public.annotation_flags ENABLE ROW LEVEL SECURITY;

-- Users who own the annotation can manage its flags
CREATE POLICY "Users can manage own annotation flags"
  ON public.annotation_flags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM annotations a WHERE a.id = annotation_flags.annotation_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM annotations a WHERE a.id = annotation_flags.annotation_id AND a.user_id = auth.uid()
    )
  );

-- Managers can manage all org annotation flags
CREATE POLICY "Managers can manage org annotation flags"
  ON public.annotation_flags FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM annotations a
      JOIN projects p ON p.id = a.project_id
      WHERE a.id = annotation_flags.annotation_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM annotations a
      JOIN projects p ON p.id = a.project_id
      WHERE a.id = annotation_flags.annotation_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  );

-- QC can manage flags on annotations they can access
CREATE POLICY "QC can manage assigned annotation flags"
  ON public.annotation_flags FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'qc'::app_role)
    AND EXISTS (
      SELECT 1 FROM annotations a
      JOIN sub_tasks st ON st.file_id = a.file_id
      JOIN tasks t ON t.id = st.task_id
      WHERE a.id = annotation_flags.annotation_id
        AND t.qa_assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'qc'::app_role)
    AND EXISTS (
      SELECT 1 FROM annotations a
      JOIN sub_tasks st ON st.file_id = a.file_id
      JOIN tasks t ON t.id = st.task_id
      WHERE a.id = annotation_flags.annotation_id
        AND t.qa_assigned_to = auth.uid()
    )
  );
