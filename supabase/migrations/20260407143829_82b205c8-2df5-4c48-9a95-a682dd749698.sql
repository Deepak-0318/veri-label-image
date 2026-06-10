-- Restrict profiles SELECT to own profile or same-org members
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR get_user_org_id(id) = get_user_org_id(auth.uid())
);