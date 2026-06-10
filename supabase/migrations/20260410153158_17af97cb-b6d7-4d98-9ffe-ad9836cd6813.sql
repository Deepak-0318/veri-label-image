
CREATE POLICY "Org owners can view own org"
ON public.organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());
