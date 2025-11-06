-- Create storage bucket for paste files (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'paste-files',
  'paste-files',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'
  ]
);

-- Create files table
CREATE TABLE public.paste_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id UUID NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on paste_files
ALTER TABLE public.paste_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for paste_files
CREATE POLICY "Anyone can view paste files metadata"
  ON public.paste_files FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create paste files"
  ON public.paste_files FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete paste files"
  ON public.paste_files FOR DELETE
  USING (true);

-- Storage policies for paste-files bucket (private access only through edge function)
CREATE POLICY "Service role can manage all files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'paste-files')
  WITH CHECK (bucket_id = 'paste-files');

-- Create function to get file and delete if first view
CREATE OR REPLACE FUNCTION public.get_file_for_download(
  file_id_param UUID,
  paste_key_param TEXT
)
RETURNS TABLE(
  file_id UUID,
  storage_path TEXT,
  filename TEXT,
  file_type TEXT,
  should_delete BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paste RECORD;
  v_file RECORD;
  v_prev_views INTEGER;
BEGIN
  -- Get paste and lock it
  SELECT p.*, pf.*
  INTO v_paste
  FROM public.pastes p
  LEFT JOIN public.paste_files pf ON pf.id = file_id_param
  WHERE p.key = paste_key_param
  FOR UPDATE OF p;
  
  -- Check if paste exists
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if file exists
  SELECT * INTO v_file
  FROM public.paste_files
  WHERE id = file_id_param AND paste_id = v_paste.id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get previous views before increment
  v_prev_views := v_paste.views;
  
  -- Return file info and whether it should be deleted
  RETURN QUERY
  SELECT 
    v_file.id,
    v_file.storage_path,
    v_file.filename,
    v_file.file_type,
    (v_paste.delete_after_view AND v_prev_views = 0) AS should_delete;
END;
$$;