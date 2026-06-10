
-- Audit logs table for comprehensive action tracking
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  entity_type text,
  entity_id uuid,
  entity_name text,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_category ON public.audit_logs(category);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs in their organization
CREATE POLICY "Admins can view org audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id = get_user_org_id(auth.uid())
);

-- Managers can view org audit logs
CREATE POLICY "Managers can view org audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND organization_id = get_user_org_id(auth.uid())
);

-- All authenticated users can insert audit logs (for their own org)
CREATE POLICY "Users can create audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
