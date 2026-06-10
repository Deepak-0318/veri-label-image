
INSERT INTO public.pipeline_block_templates (name, category, block_type, description, icon, default_config, is_system) VALUES
  -- IO blocks
  ('File Input', 'io', 'io', 'Read files from project or storage', 'Download', '{"source": "project", "file_type": "any"}'::jsonb, true),
  ('File Output', 'io', 'io', 'Write results to file or storage', 'Upload', '{"destination": "project", "format": "json"}'::jsonb, true),
  ('Data Source', 'io', 'io', 'Connect to an external data source', 'Database', '{"source_type": "database", "connection": ""}'::jsonb, true),
  ('Export Output', 'io', 'io', 'Export pipeline results in various formats', 'FileOutput', '{"format": "csv", "destination": "download"}'::jsonb, true),
  -- Operations blocks
  ('File Read', 'operations', 'function', 'Read and parse file contents (CSV, JSON, TXT)', 'FileText', '{"file_type": "auto", "encoding": "utf-8"}'::jsonb, true),
  ('API Call', 'operations', 'function', 'Make HTTP requests to external APIs', 'Globe', '{"method": "GET", "url": "", "headers": {}, "body": ""}'::jsonb, true),
  ('Batch Process', 'operations', 'function', 'Process items in configurable batch sizes', 'Layers', '{"batch_size": 10, "parallel": false}'::jsonb, true),
  ('Delay', 'operations', 'function', 'Add a timed delay between pipeline steps', 'Clock', '{"delay_ms": 1000}'::jsonb, true),
  ('Logger', 'operations', 'function', 'Log data at any pipeline stage for debugging', 'Terminal', '{"level": "info", "format": "json"}'::jsonb, true),
  ('Retry', 'operations', 'function', 'Retry failed operations with backoff', 'RefreshCw', '{"max_retries": 3, "backoff_ms": 1000}'::jsonb, true);
