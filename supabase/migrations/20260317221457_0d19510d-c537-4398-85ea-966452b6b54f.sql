
-- Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Organization members junction table
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function: check if user is member of an org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Security definer function: check if user is org owner
CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id AND owner_id = _user_id
  )
$$;

-- Security definer function: get user's org id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = _user_id
  LIMIT 1
$$;

-- RLS for organizations
CREATE POLICY "Members can view their org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owner can delete org"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS for organization_members
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org owners and managers can add members"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_owner(auth.uid(), organization_id)
    OR (public.is_org_member(auth.uid(), organization_id) AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Org owners and managers can remove members"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    public.is_org_owner(auth.uid(), organization_id)
    OR (public.is_org_member(auth.uid(), organization_id) AND (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')))
    OR user_id = auth.uid()
  );
