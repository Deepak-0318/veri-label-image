
-- Allow annotators to see unassigned pool tasks in their organization
CREATE POLICY "Annotators can view unassigned pool tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  assigned_to IS NULL
  AND has_role(auth.uid(), 'annotator'::app_role)
  AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
);

-- Allow annotators to claim unassigned pool tasks (set assigned_to to themselves)
CREATE POLICY "Annotators can claim unassigned tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to IS NULL
  AND has_role(auth.uid(), 'annotator'::app_role)
  AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
)
WITH CHECK (
  assigned_to = auth.uid()
  AND has_role(auth.uid(), 'annotator'::app_role)
);

-- Allow QC to see unassigned pool tasks in review status in their org
CREATE POLICY "QC can view unassigned review tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  qa_assigned_to IS NULL
  AND status = 'review'
  AND has_role(auth.uid(), 'qc'::app_role)
  AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
);

-- Allow QC to claim unassigned review tasks
CREATE POLICY "QC can claim unassigned review tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  qa_assigned_to IS NULL
  AND status = 'review'
  AND has_role(auth.uid(), 'qc'::app_role)
  AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
)
WITH CHECK (
  qa_assigned_to = auth.uid()
  AND has_role(auth.uid(), 'qc'::app_role)
);

-- Allow annotators to view sub_tasks for unassigned pool tasks they can see
CREATE POLICY "Annotators can view unassigned pool sub_tasks"
ON public.sub_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
    AND t.assigned_to IS NULL
    AND has_role(auth.uid(), 'annotator'::app_role)
    AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
  )
);

-- Allow QC to view sub_tasks for unassigned review pool tasks
CREATE POLICY "QC can view unassigned review sub_tasks"
ON public.sub_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
    AND t.qa_assigned_to IS NULL
    AND t.status = 'review'
    AND has_role(auth.uid(), 'qc'::app_role)
    AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
  )
);
