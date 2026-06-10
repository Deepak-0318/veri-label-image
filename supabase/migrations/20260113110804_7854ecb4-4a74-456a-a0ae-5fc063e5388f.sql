-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects
CREATE POLICY "Users can view their own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add project_id to files table to associate files with projects
ALTER TABLE public.files ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for project_id on files
CREATE INDEX idx_files_project_id ON public.files(project_id);