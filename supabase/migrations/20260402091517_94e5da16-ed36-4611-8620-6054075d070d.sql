
-- QC can view tasks assigned to them
CREATE POLICY "QC can view assigned tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND assigned_to = auth.uid()
);

-- QC can view sub_tasks for their assigned tasks
CREATE POLICY "QC can view assigned sub_tasks"
ON public.sub_tasks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND
  EXISTS (SELECT 1 FROM tasks WHERE tasks.id = sub_tasks.task_id AND tasks.assigned_to = auth.uid())
);

-- QC can update sub_tasks for their assigned tasks
CREATE POLICY "QC can update assigned sub_tasks"
ON public.sub_tasks FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND
  EXISTS (SELECT 1 FROM tasks WHERE tasks.id = sub_tasks.task_id AND tasks.assigned_to = auth.uid())
);

-- QC can view files linked to their assigned tasks
CREATE POLICY "QC can view assigned task files"
ON public.files FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND
  EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = files.id AND t.assigned_to = auth.uid()
  )
);

-- QC can view annotations on files in their assigned tasks
CREATE POLICY "QC can view task annotations"
ON public.annotations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND
  EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id AND t.assigned_to = auth.uid()
  )
);

-- QC can view project label types for their assigned tasks
CREATE POLICY "QC can view project label types"
ON public.project_label_types FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND
  EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_label_types.project_id AND t.assigned_to = auth.uid())
);

-- QC can view project labels for their assigned tasks
CREATE POLICY "QC can view project labels"
ON public.project_labels FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND
  EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_labels.project_id AND t.assigned_to = auth.uid())
);
