-- Allow annotators to update annotations on files assigned to them via tasks
CREATE POLICY "Annotators can update task annotations"
ON public.annotations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'annotator'::app_role)
  AND EXISTS (
    SELECT 1
    FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
      AND t.assigned_to = auth.uid()
  )
);

-- Allow annotators to delete annotations on files assigned to them via tasks
CREATE POLICY "Annotators can delete task annotations"
ON public.annotations
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'annotator'::app_role)
  AND EXISTS (
    SELECT 1
    FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = annotations.file_id
      AND t.assigned_to = auth.uid()
  )
);
