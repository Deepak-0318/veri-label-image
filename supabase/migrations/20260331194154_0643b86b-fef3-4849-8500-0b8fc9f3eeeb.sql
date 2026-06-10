
CREATE TABLE public.pending_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'annotator',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Managers/admins in the org can view invitations
CREATE POLICY "Org managers can view invitations"
  ON public.pending_invitations FOR SELECT
  TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Managers/admins can create invitations
CREATE POLICY "Org managers can create invitations"
  ON public.pending_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(auth.uid(), organization_id)
    AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND invited_by = auth.uid()
  );

-- Managers/admins can delete invitations
CREATE POLICY "Org managers can delete invitations"
  ON public.pending_invitations FOR DELETE
  TO authenticated
  USING (
    is_org_member(auth.uid(), organization_id)
    AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Users can view their own pending invitations (by email match via profiles)
CREATE POLICY "Users can view own invitations"
  ON public.pending_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Users can update their own invitations (to accept)
CREATE POLICY "Users can accept own invitations"
  ON public.pending_invitations FOR UPDATE
  TO authenticated
  USING (
    email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
  );
