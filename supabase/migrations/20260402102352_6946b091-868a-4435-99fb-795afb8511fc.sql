
-- Fix tasks: scope manager/admin access to same organization
DROP POLICY IF EXISTS "Managers can manage tasks" ON public.tasks;
CREATE POLICY "Managers can manage tasks"
  ON public.tasks
  FOR ALL
  TO public
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND get_user_org_id(auth.uid()) IS NOT NULL
  );
