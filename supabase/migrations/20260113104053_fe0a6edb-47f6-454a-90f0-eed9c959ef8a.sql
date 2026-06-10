-- Create files table to store uploaded files metadata
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size BIGINT,
  thumbnail_url TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create annotations table
CREATE TABLE public.annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('boundingBox', 'polygon', 'textHighlight')),
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create labels table for custom labels
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- RLS policies for files
CREATE POLICY "Users can view their own files" ON public.files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own files" ON public.files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own files" ON public.files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own files" ON public.files FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for annotations
CREATE POLICY "Users can view their own annotations" ON public.annotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own annotations" ON public.annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own annotations" ON public.annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own annotations" ON public.annotations FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for labels
CREATE POLICY "Users can view their own labels" ON public.labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own labels" ON public.labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own labels" ON public.labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own labels" ON public.labels FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_files_user_id ON public.files(user_id);
CREATE INDEX idx_annotations_file_id ON public.annotations(file_id);
CREATE INDEX idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX idx_labels_user_id ON public.labels(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();