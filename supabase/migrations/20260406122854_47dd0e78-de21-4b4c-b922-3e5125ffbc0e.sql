
-- Create project_group_types table
CREATE TABLE public.project_group_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint per project+name
ALTER TABLE public.project_group_types ADD CONSTRAINT unique_project_group_type_name UNIQUE (project_id, name);

-- Enable RLS
ALTER TABLE public.project_group_types ENABLE ROW LEVEL SECURITY;

-- Project owners can manage their group types
CREATE POLICY "Project owners can manage group types"
ON public.project_group_types FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_group_types.project_id AND p.user_id = auth.uid()))
WITH CHECK (created_by = auth.uid());

-- Managers can manage org group types
CREATE POLICY "Managers can manage org group types"
ON public.project_group_types FOR ALL TO authenticated
USING ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')) AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_group_types.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())))
WITH CHECK ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')) AND created_by = auth.uid());

-- Annotators can view group types for their assigned projects
CREATE POLICY "Annotators can view project group types"
ON public.project_group_types FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_group_types.project_id AND t.assigned_to = auth.uid()));

-- QC can view project group types
CREATE POLICY "QC can view project group types"
ON public.project_group_types FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'qc') AND EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_group_types.project_id AND t.assigned_to = auth.uid()));

-- Add group_type_id column to annotations table
ALTER TABLE public.annotations ADD COLUMN group_type_id UUID REFERENCES public.project_group_types(id) ON DELETE SET NULL;
