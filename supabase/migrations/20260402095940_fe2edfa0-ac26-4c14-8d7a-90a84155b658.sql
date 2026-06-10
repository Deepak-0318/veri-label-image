
-- Allow org owners to assign themselves the admin role
CREATE POLICY "Org owners can self-assign admin role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'::app_role
  AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE owner_id = auth.uid()
  )
);
