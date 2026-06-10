-- Ensure user_roles exists
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Missing columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS qa_status text;
ALTER TABLE public.project_label_types ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.project_label_types ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- User roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view all roles" ON public.user_roles;
CREATE POLICY "Managers can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Managers can delete roles" ON public.user_roles;
CREATE POLICY "Managers can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Managers can update roles" ON public.user_roles;
CREATE POLICY "Managers can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can get role via invitation" ON public.user_roles;
CREATE POLICY "Users can get role via invitation" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM pending_invitations pi JOIN profiles p ON p.id = auth.uid() WHERE pi.email = p.email AND pi.status = 'pending' AND pi.role::text = user_roles.role::text));
DROP POLICY IF EXISTS "Org owners can self-assign admin role" ON public.user_roles;
CREATE POLICY "Org owners can self-assign admin role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role = 'admin'::app_role AND EXISTS (SELECT 1 FROM organizations WHERE owner_id = auth.uid()));

-- Org-scoped task policies
DROP POLICY IF EXISTS "Managers can manage tasks" ON public.tasks;
CREATE POLICY "Managers can manage tasks" ON public.tasks FOR ALL TO public USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND get_user_org_id(created_by) = get_user_org_id(auth.uid())) WITH CHECK ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND get_user_org_id(auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
CREATE POLICY "Users can view assigned tasks" ON public.tasks FOR SELECT USING (assigned_to = auth.uid());

-- QC task policies
DROP POLICY IF EXISTS "QC can view assigned tasks" ON public.tasks;
CREATE POLICY "QC can view assigned tasks" ON public.tasks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND (assigned_to = auth.uid() OR qa_assigned_to = auth.uid()));

-- Org-scoped pipeline policies
DROP POLICY IF EXISTS "Managers and creators can view pipelines" ON public.pipelines;
CREATE POLICY "Managers and creators can view pipelines" ON public.pipelines FOR SELECT TO authenticated USING ((created_by = auth.uid()) OR ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND get_user_org_id(created_by) = get_user_org_id(auth.uid())));
DROP POLICY IF EXISTS "Managers can delete pipelines" ON public.pipelines;
CREATE POLICY "Managers can delete pipelines" ON public.pipelines FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND get_user_org_id(created_by) = get_user_org_id(auth.uid())));
DROP POLICY IF EXISTS "Managers can update pipelines" ON public.pipelines;
CREATE POLICY "Managers can update pipelines" ON public.pipelines FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND get_user_org_id(created_by) = get_user_org_id(auth.uid())));

-- Org-scoped file/annotation/project/segment policies
DROP POLICY IF EXISTS "Org members can view org files" ON public.files;
CREATE POLICY "Org members can view org files" ON public.files FOR SELECT TO authenticated USING (get_user_org_id(auth.uid()) IS NOT NULL AND get_user_org_id(user_id) = get_user_org_id(auth.uid()));
DROP POLICY IF EXISTS "Org members can manage org files" ON public.files;
CREATE POLICY "Org members can manage org files" ON public.files FOR ALL TO authenticated USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND get_user_org_id(user_id) = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Managers can view org annotations" ON public.annotations;
CREATE POLICY "Managers can view org annotations" ON public.annotations FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = annotations.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())));
DROP POLICY IF EXISTS "Managers can update org annotations" ON public.annotations;
CREATE POLICY "Managers can update org annotations" ON public.annotations FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = annotations.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())));
DROP POLICY IF EXISTS "Managers can delete org annotations" ON public.annotations;
CREATE POLICY "Managers can delete org annotations" ON public.annotations FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = annotations.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())));
DROP POLICY IF EXISTS "Managers can create annotations in org projects" ON public.annotations;
CREATE POLICY "Managers can create annotations in org projects" ON public.annotations FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = annotations.project_id AND get_user_org_id(p.user_id) = get_user_org_id(auth.uid())));

DROP POLICY IF EXISTS "Org members can view org projects" ON public.projects;
CREATE POLICY "Org members can view org projects" ON public.projects FOR SELECT TO authenticated USING (get_user_org_id(auth.uid()) IS NOT NULL AND get_user_org_id(user_id) = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Org members can view org segments" ON public.segments;
CREATE POLICY "Org members can view org segments" ON public.segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM files f WHERE f.id = file_id AND get_user_org_id(f.user_id) = get_user_org_id(auth.uid())));
DROP POLICY IF EXISTS "Managers can manage org segments" ON public.segments;
CREATE POLICY "Managers can manage org segments" ON public.segments FOR ALL TO authenticated USING ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND EXISTS (SELECT 1 FROM files f WHERE f.id = file_id AND get_user_org_id(f.user_id) = get_user_org_id(auth.uid())));

-- QC policies
DROP POLICY IF EXISTS "QC can view assigned sub_tasks" ON public.sub_tasks;
CREATE POLICY "QC can view assigned sub_tasks" ON public.sub_tasks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = sub_tasks.task_id AND tasks.qa_assigned_to = auth.uid()));
DROP POLICY IF EXISTS "QC can update assigned sub_tasks" ON public.sub_tasks;
CREATE POLICY "QC can update assigned sub_tasks" ON public.sub_tasks FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = sub_tasks.task_id AND tasks.qa_assigned_to = auth.uid()));
DROP POLICY IF EXISTS "QC can view assigned task files" ON public.files;
CREATE POLICY "QC can view assigned task files" ON public.files FOR SELECT TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM sub_tasks st JOIN tasks t ON t.id = st.task_id WHERE st.file_id = files.id AND t.qa_assigned_to = auth.uid()));
DROP POLICY IF EXISTS "QC can view task annotations" ON public.annotations;
CREATE POLICY "QC can view task annotations" ON public.annotations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM sub_tasks st JOIN tasks t ON t.id = st.task_id WHERE st.file_id = annotations.file_id AND t.qa_assigned_to = auth.uid()));
DROP POLICY IF EXISTS "QC can update task annotations" ON public.annotations;
CREATE POLICY "QC can update task annotations" ON public.annotations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM sub_tasks st JOIN tasks t ON t.id = st.task_id WHERE st.file_id = annotations.file_id AND t.qa_assigned_to = auth.uid()));
DROP POLICY IF EXISTS "QC can view project label types" ON public.project_label_types;
CREATE POLICY "QC can view project label types" ON public.project_label_types FOR SELECT TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_label_types.project_id AND t.assigned_to = auth.uid()));
DROP POLICY IF EXISTS "QC can view project labels" ON public.project_labels;
CREATE POLICY "QC can view project labels" ON public.project_labels FOR SELECT TO authenticated USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project_labels.project_id AND t.assigned_to = auth.uid()));

-- Annotator policies
DROP POLICY IF EXISTS "Annotators can view assigned task files" ON public.files;
CREATE POLICY "Annotators can view assigned task files" ON public.files FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sub_tasks st JOIN tasks t ON t.id = st.task_id WHERE st.file_id = files.id AND t.assigned_to = auth.uid()));
DROP POLICY IF EXISTS "Annotators can view task annotations" ON public.annotations;
CREATE POLICY "Annotators can view task annotations" ON public.annotations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sub_tasks st JOIN tasks t ON t.id = st.task_id WHERE st.file_id = annotations.file_id AND t.assigned_to = auth.uid()));
DROP POLICY IF EXISTS "Annotators can create task annotations" ON public.annotations;
CREATE POLICY "Annotators can create task annotations" ON public.annotations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM sub_tasks st JOIN tasks t ON t.id = st.task_id WHERE st.file_id = annotations.file_id AND t.assigned_to = auth.uid()));

-- Invitation-based joins
DROP POLICY IF EXISTS "Users can join org via invitation" ON public.organization_members;
CREATE POLICY "Users can join org via invitation" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM pending_invitations pi JOIN profiles p ON p.id = auth.uid() WHERE pi.organization_id = organization_members.organization_id AND pi.email = p.email AND pi.status = 'pending'));
DROP POLICY IF EXISTS "Invited users can view org" ON public.organizations;
CREATE POLICY "Invited users can view org" ON public.organizations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM pending_invitations pi JOIN profiles p ON p.id = auth.uid() WHERE pi.organization_id = organizations.id AND pi.email = p.email AND pi.status = 'pending'));