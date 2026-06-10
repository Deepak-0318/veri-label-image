
-- Allow managers/admins to update files belonging to their organization
CREATE POLICY "Managers can update org files"
ON public.files
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND project_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = files.project_id
    AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
  )
);
