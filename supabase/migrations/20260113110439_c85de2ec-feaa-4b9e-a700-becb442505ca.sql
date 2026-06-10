-- Create the 'files' storage bucket for user uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true);

-- RLS policies for the files bucket

-- Users can view their own files (files stored in user_id folder)
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can upload files to their own folder
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);