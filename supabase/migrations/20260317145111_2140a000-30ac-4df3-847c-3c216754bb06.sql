
-- Allow managers to insert roles
CREATE POLICY "Managers can insert roles"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow managers to delete roles
CREATE POLICY "Managers can delete roles"
ON public.user_roles
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow managers to update roles
CREATE POLICY "Managers can update roles"
ON public.user_roles
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);
