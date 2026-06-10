
-- Allow users to join an org when they have a pending invitation for it
CREATE POLICY "Users can join org via invitation"
ON public.organization_members
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.pending_invitations pi
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE pi.organization_id = organization_members.organization_id
      AND pi.email = p.email
      AND pi.status = 'pending'
  )
);

-- Allow users to get a role when they have a pending invitation
CREATE POLICY "Users can get role via invitation"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.pending_invitations pi
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE pi.email = p.email
      AND pi.status = 'pending'
      AND pi.role::text = user_roles.role::text
  )
);
