-- Add views column to paste_files table
ALTER TABLE public.paste_files ADD COLUMN views INTEGER NOT NULL DEFAULT 0;

-- Update get_file_for_download function to track file views instead of paste views
CREATE OR REPLACE FUNCTION public.get_file_for_download(file_id_param uuid, paste_key_param text)
RETURNS TABLE(file_id uuid, storage_path text, filename text, file_type text, should_delete boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_paste RECORD;
  v_file RECORD;
  v_prev_file_views INTEGER;
BEGIN
  -- Get paste and file info
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
  
  -- Get file and lock it
  SELECT * INTO v_file
  FROM public.paste_files
  WHERE id = file_id_param AND paste_id = v_paste.id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Store previous file view count
  v_prev_file_views := v_file.views;
  
  -- Increment file views
  UPDATE public.paste_files
  SET views = views + 1
  WHERE id = file_id_param;
  
  -- Return file info and whether it should be deleted (first view + delete_after_view enabled)
  RETURN QUERY
  SELECT 
    v_file.id,
    v_file.storage_path,
    v_file.filename,
    v_file.file_type,
    (v_paste.delete_after_view AND v_prev_file_views = 0) AS should_delete;
END;
$function$;