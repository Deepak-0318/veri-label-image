-- Drop the existing ALL policy that requires has_role (blocks inserts for users without roles)
DROP POLICY IF EXISTS "Managers can manage pipelines" ON public.pipelines;

-- SELECT: managers/admins OR pipeline creator
CREATE POLICY "Managers and creators can view pipelines"
ON public.pipelines FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- INSERT: managers/admins, created_by must match auth.uid()
CREATE POLICY "Managers can create pipelines"
ON public.pipelines FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- UPDATE: managers/admins or creator
CREATE POLICY "Managers can update pipelines"
ON public.pipelines FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- DELETE: managers/admins or creator
CREATE POLICY "Managers can delete pipelines"
ON public.pipelines FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Assign manager role to the current user
INSERT INTO public.user_roles (user_id, role)
VALUES ('2980e7b0-5802-4e55-8819-799a9a604d3d', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;