-- Fix Annotators policies for annotations table
DROP POLICY IF EXISTS "Annotators can view task annotations" ON public.annotations;
CREATE POLICY "Annotators can view task annotations" ON public.annotations FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND (
      t.assigned_to = auth.uid()
      OR (t.assigned_to IS NULL AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS "Annotators can create task annotations" ON public.annotations;
CREATE POLICY "Annotators can create task annotations" ON public.annotations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND t.assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Annotators can update task annotations" ON public.annotations;
CREATE POLICY "Annotators can update task annotations" ON public.annotations FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND t.assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Annotators can delete task annotations" ON public.annotations;
CREATE POLICY "Annotators can delete task annotations" ON public.annotations FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND t.assigned_to = auth.uid()
  )
);

-- Fix QC policies for annotations table
DROP POLICY IF EXISTS "QC can view task annotations" ON public.annotations;
CREATE POLICY "QC can view task annotations" ON public.annotations FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND (
      t.qa_assigned_to = auth.uid()
      OR (t.qa_assigned_to IS NULL AND t.status = 'review' AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS "QC can create task annotations" ON public.annotations;
CREATE POLICY "QC can create task annotations" ON public.annotations FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND t.qa_assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "QC can update task annotations" ON public.annotations;
CREATE POLICY "QC can update task annotations" ON public.annotations FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND t.qa_assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "QC can delete task annotations" ON public.annotations;
CREATE POLICY "QC can delete task annotations" ON public.annotations FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
    AND t.qa_assigned_to = auth.uid()
  )
);

-- Fix Admin access policy for annotations table
DROP POLICY IF EXISTS "Admins have full access to annotations" ON public.annotations;
CREATE POLICY "Admins have full access to annotations" ON public.annotations FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Fix project labels and label types visibility for QC
DROP POLICY IF EXISTS "QC can view project label types" ON public.project_label_types;
CREATE POLICY "QC can view project label types" ON public.project_label_types FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.project_id = project_label_types.project_id
    AND (t.assigned_to = auth.uid() OR t.qa_assigned_to = auth.uid())
  )
);

DROP POLICY IF EXISTS "QC can view project labels" ON public.project_labels;
CREATE POLICY "QC can view project labels" ON public.project_labels FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.project_id = project_labels.project_id
    AND (t.assigned_to = auth.uid() OR t.qa_assigned_to = auth.uid())
  )
);
