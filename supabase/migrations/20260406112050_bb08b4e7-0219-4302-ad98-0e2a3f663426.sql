CREATE POLICY "QC can create annotations on assigned files"
ON public.annotations
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'qc'::app_role)
  AND auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
      AND t.qa_assigned_to = auth.uid()
  )
);