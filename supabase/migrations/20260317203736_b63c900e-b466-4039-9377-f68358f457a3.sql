
-- Pipeline block templates table
CREATE TABLE public.pipeline_block_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  block_type text NOT NULL DEFAULT 'custom',
  description text,
  icon text NOT NULL DEFAULT 'Zap',
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  script text,
  language text NOT NULL DEFAULT 'python',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_block_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view system blocks
CREATE POLICY "Anyone can view system blocks"
  ON public.pipeline_block_templates FOR SELECT
  TO authenticated
  USING (is_system = true);

-- Users can view their own custom blocks
CREATE POLICY "Users can view own blocks"
  ON public.pipeline_block_templates FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Users can create their own blocks
CREATE POLICY "Users can create blocks"
  ON public.pipeline_block_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_system = false);

-- Users can update their own blocks
CREATE POLICY "Users can update own blocks"
  ON public.pipeline_block_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND is_system = false);

-- Users can delete their own blocks
CREATE POLICY "Users can delete own blocks"
  ON public.pipeline_block_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND is_system = false);

-- Admins can manage all blocks
CREATE POLICY "Admins can manage all blocks"
  ON public.pipeline_block_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_pipeline_block_templates_updated_at
  BEFORE UPDATE ON public.pipeline_block_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed system blocks
INSERT INTO public.pipeline_block_templates (name, category, block_type, description, icon, default_config, is_system) VALUES
  ('Whisper Transcription', 'ai', 'ai', 'Speech-to-text transcription using OpenAI Whisper', 'Brain', '{"model": "whisper", "task": "transcription"}'::jsonb, true),
  ('Speaker Diarization', 'ai', 'ai', 'Identify and separate speakers in audio', 'Brain', '{"model": "pyannote", "task": "diarization"}'::jsonb, true),
  ('Emotion Recognition', 'ai', 'ai', 'Detect emotions in speech or text', 'Brain', '{"model": "emotion", "task": "emotion_recognition"}'::jsonb, true),
  ('Sentiment Analysis', 'ai', 'ai', 'Analyze text sentiment (positive/negative/neutral)', 'Brain', '{"model": "sentiment", "task": "sentiment_analysis"}'::jsonb, true),
  ('NER Tagging', 'ai', 'ai', 'Named entity recognition for text', 'Brain', '{"model": "ner", "task": "entity_recognition"}'::jsonb, true),
  ('Filter', 'transform', 'function', 'Filter data based on conditions', 'Code', '{"function": "filter", "params": {}}'::jsonb, true),
  ('Map', 'transform', 'function', 'Transform each item in the data', 'Code', '{"function": "map", "params": {}}'::jsonb, true),
  ('Merge', 'transform', 'function', 'Combine multiple data sources', 'Code', '{"function": "merge", "params": {}}'::jsonb, true),
  ('Split', 'transform', 'function', 'Split data into multiple streams', 'Code', '{"function": "split", "params": {}}'::jsonb, true),
  ('If/Else', 'condition', 'logical', 'Branch pipeline based on a condition', 'GitBranch', '{"condition": "", "trueBranch": "", "falseBranch": ""}'::jsonb, true),
  ('Switch', 'condition', 'logical', 'Multi-way branch based on value matching', 'GitBranch', '{"field": "", "cases": {}}'::jsonb, true),
  ('Custom Python Block', 'custom', 'custom', 'User-defined processing logic written in Python', 'Zap', '{"script": "# Write your Python code here\ndef process(data):\n    return data"}'::jsonb, true);
