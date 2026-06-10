-- Allow managers/admins to insert sub_tasks for tasks in their org
CREATE POLICY "Managers can insert sub_tasks"
ON public.sub_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
      AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
  )
);

-- Allow managers/admins to view sub_tasks in their org
CREATE POLICY "Managers can view org sub_tasks"
ON public.sub_tasks
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
      AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
  )
);

-- Allow annotators to view their assigned sub_tasks
CREATE POLICY "Annotators can view assigned sub_tasks"
ON public.sub_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
      AND t.assigned_to = auth.uid()
  )
);

-- Allow annotators to update their assigned sub_tasks
CREATE POLICY "Annotators can update assigned sub_tasks"
ON public.sub_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
      AND t.assigned_to = auth.uid()
  )
);

-- Allow managers/admins to update org sub_tasks
CREATE POLICY "Managers can update org sub_tasks"
ON public.sub_tasks
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
      AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
  )
);

-- Allow managers/admins to delete org sub_tasks
CREATE POLICY "Managers can delete org sub_tasks"
ON public.sub_tasks
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = sub_tasks.task_id
      AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
  )
);