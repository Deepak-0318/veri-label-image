-- Add is_archived column to projects
ALTER TABLE public.projects
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
