
ALTER TABLE public.tasks
  ADD COLUMN qa_assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN qa_status TEXT DEFAULT NULL;
