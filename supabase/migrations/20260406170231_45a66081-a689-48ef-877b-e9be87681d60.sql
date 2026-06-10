CREATE TABLE public.transform_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  output_format text NOT NULL DEFAULT 'json',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.transform_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scripts" ON public.transform_scripts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own scripts" ON public.transform_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scripts" ON public.transform_scripts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scripts" ON public.transform_scripts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_transform_scripts_updated_at BEFORE UPDATE ON public.transform_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();