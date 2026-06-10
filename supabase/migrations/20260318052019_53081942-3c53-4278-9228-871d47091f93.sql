-- Allow org owners to SELECT their org even before being added as a member
CREATE POLICY "Owner can view own org"
ON public.organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());