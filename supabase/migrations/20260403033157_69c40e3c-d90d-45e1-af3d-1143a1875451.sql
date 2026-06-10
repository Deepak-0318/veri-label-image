-- Fix pipelines: scope manager/admin access to same organization
DROP POLICY IF EXISTS "Managers and creators can view pipelines" ON public.pipelines;
CREATE POLICY "Managers and creators can view pipelines"
  ON public.pipelines FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid())
    OR (
      (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
      AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can delete pipelines" ON public.pipelines;
CREATE POLICY "Managers can delete pipelines"
  ON public.pipelines FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid())
    OR (
      (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
      AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can update pipelines" ON public.pipelines;
CREATE POLICY "Managers can update pipelines"
  ON public.pipelines FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid())
    OR (
      (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
      AND get_user_org_id(created_by) = get_user_org_id(auth.uid())
    )
  );

-- Fix pipeline_runs: scope manager/admin view to same organization
DROP POLICY IF EXISTS "Managers can view all pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Managers can view org pipeline runs"
  ON public.pipeline_runs FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND get_user_org_id(started_by) = get_user_org_id(auth.uid())
  );

-- Fix sub_tasks: scope manager/admin access to same organization
DROP POLICY IF EXISTS "Managers can manage sub_tasks" ON public.sub_tasks;
CREATE POLICY "Managers can manage sub_tasks"
  ON public.sub_tasks FOR ALL TO public
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = sub_tasks.task_id
        AND get_user_org_id(t.created_by) = get_user_org_id(auth.uid())
    )
  );

-- Fix segments: scope manager/admin access to same organization
DROP POLICY IF EXISTS "Managers can manage all segments" ON public.segments;
CREATE POLICY "Managers can manage org segments"
  ON public.segments FOR ALL TO public
  USING (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM files f
      WHERE f.id = segments.file_id
        AND get_user_org_id(f.user_id) = get_user_org_id(auth.uid())
    )
  );