
-- Allow managers/admins to view projects from users in the same organization
CREATE POLICY "Managers can view org projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND get_user_org_id(user_id) = get_user_org_id(auth.uid())
);

-- Allow managers/admins to update org projects
CREATE POLICY "Managers can update org projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND get_user_org_id(user_id) = get_user_org_id(auth.uid())
);

-- Allow managers/admins to view files from org projects
CREATE POLICY "Managers can view org files"
ON public.files FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = files.project_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  )
);

-- Allow managers/admins to view annotations from org projects
CREATE POLICY "Managers can view org annotations"
ON public.annotations FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = annotations.project_id
        AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())
    )
  )
);
