-- Fix QC annotations SELECT: uses assigned_to instead of qa_assigned_to
DROP POLICY IF EXISTS "QC can view task annotations" ON public.annotations;
CREATE POLICY "QC can view task annotations"
ON public.annotations FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- Fix QC files SELECT: uses assigned_to instead of qa_assigned_to
DROP POLICY IF EXISTS "QC can view assigned task files" ON public.files;
CREATE POLICY "QC can view assigned task files"
ON public.files FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = files.id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- Fix QC sub_tasks SELECT: uses assigned_to instead of qa_assigned_to
DROP POLICY IF EXISTS "QC can view assigned sub_tasks" ON public.sub_tasks;
CREATE POLICY "QC can view assigned sub_tasks"
ON public.sub_tasks FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = sub_tasks.task_id
      AND tasks.qa_assigned_to = auth.uid()
  )
);

-- Fix QC sub_tasks UPDATE: uses assigned_to instead of qa_assigned_to
DROP POLICY IF EXISTS "QC can update assigned sub_tasks" ON public.sub_tasks;
CREATE POLICY "QC can update assigned sub_tasks"
ON public.sub_tasks FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = sub_tasks.task_id
      AND tasks.qa_assigned_to = auth.uid()
  )
);

-- Fix QC project_flags SELECT
DROP POLICY IF EXISTS "QC can view project flags" ON public.project_flags;
CREATE POLICY "QC can view project flags"
ON public.project_flags FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.project_id = project_flags.project_id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- Fix QC project_group_types SELECT
DROP POLICY IF EXISTS "QC can view project group types" ON public.project_group_types;
CREATE POLICY "QC can view project group types"
ON public.project_group_types FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.project_id = project_group_types.project_id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- Fix QC project_label_types SELECT
DROP POLICY IF EXISTS "QC can view project label types" ON public.project_label_types;
CREATE POLICY "QC can view project label types"
ON public.project_label_types FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.project_id = project_label_types.project_id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- Fix QC project_labels SELECT
DROP POLICY IF EXISTS "QC can view project labels" ON public.project_labels;
CREATE POLICY "QC can view project labels"
ON public.project_labels FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.project_id = project_labels.project_id
      AND t.qa_assigned_to = auth.uid()
  )
);

-- QC also needs to view the task itself via qa_assigned_to
DROP POLICY IF EXISTS "QC can view assigned tasks" ON public.tasks;
CREATE POLICY "QC can view assigned tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND qa_assigned_to = auth.uid()
);