-- Allow users with a pending invitation to see the organization they're invited to
CREATE POLICY "Invited users can view org"
ON public.organizations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pending_invitations pi
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE pi.organization_id = organizations.id
      AND pi.email = p.email
      AND pi.status = 'pending'
  )
);