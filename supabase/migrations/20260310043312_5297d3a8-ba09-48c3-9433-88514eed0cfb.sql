
CREATE TABLE public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  format text NOT NULL DEFAULT 'json',
  file_count integer NOT NULL DEFAULT 0,
  annotation_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  download_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exports"
  ON public.exports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON public.exports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exports"
  ON public.exports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
