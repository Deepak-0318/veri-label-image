-- Allow QC users to update annotations (qc_status, qc_comment) on files assigned to them via tasks
CREATE POLICY "QC can update task annotations"
ON public.annotations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'qc'::app_role)
  AND EXISTS (
    SELECT 1
    FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
      AND t.qa_assigned_to = auth.uid()
  )
);