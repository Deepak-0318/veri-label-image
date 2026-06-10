-- Annotators can update their assigned tasks (e.g. move to review status)
CREATE POLICY "Annotators can update assigned tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- QC can update their assigned tasks (e.g. mark completed or rework)
CREATE POLICY "QC can update assigned tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role) AND qa_assigned_to = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'qc'::app_role) AND qa_assigned_to = auth.uid()
);