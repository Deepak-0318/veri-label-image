
CREATE POLICY "Managers can update org annotations"
ON public.annotations
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND project_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = annotations.project_id
    AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Managers can delete org annotations"
ON public.annotations
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND project_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = annotations.project_id
    AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
  )
);
