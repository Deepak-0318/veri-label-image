
-- Activity events table for notification/activity feed
CREATE TABLE public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  project_id UUID,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast user-scoped queries
CREATE INDEX idx_activity_events_user_id ON public.activity_events (user_id, created_at DESC);
CREATE INDEX idx_activity_events_project_id ON public.activity_events (project_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
  ON public.activity_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own activity events
CREATE POLICY "Users can create own activity"
  ON public.activity_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own activity events
CREATE POLICY "Users can delete own activity"
  ON public.activity_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
