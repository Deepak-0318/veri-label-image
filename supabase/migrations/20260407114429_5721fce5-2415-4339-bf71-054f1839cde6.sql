CREATE POLICY "Annotators can view assigned task files"
ON public.files FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE st.file_id = files.id
      AND t.assigned_to = auth.uid()
  )
);