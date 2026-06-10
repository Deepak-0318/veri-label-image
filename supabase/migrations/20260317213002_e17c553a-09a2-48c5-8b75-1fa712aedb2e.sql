-- Function to sync task progress from sub_tasks
CREATE OR REPLACE FUNCTION public.sync_task_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task_id uuid;
BEGIN
  -- Determine the relevant task_id
  IF TG_OP = 'DELETE' THEN
    _task_id := OLD.task_id;
  ELSE
    _task_id := NEW.task_id;
  END IF;

  UPDATE public.tasks SET
    total_items = (SELECT COUNT(*) FROM public.sub_tasks WHERE task_id = _task_id),
    completed_items = (SELECT COUNT(*) FROM public.sub_tasks WHERE task_id = _task_id AND status = 'completed'),
    updated_at = now()
  WHERE id = _task_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on sub_tasks changes
CREATE TRIGGER sync_task_progress_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sub_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_progress();