-- Create a function to atomically increment views and return the previous count
CREATE OR REPLACE FUNCTION public.increment_paste_views(paste_key text)
RETURNS TABLE (
  prev_views integer,
  paste_id uuid,
  paste_code text,
  paste_views integer,
  paste_created_at timestamp with time zone,
  paste_expires_at timestamp with time zone,
  paste_filename text,
  paste_delete_after_view boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_views integer;
  v_paste record;
BEGIN
  -- Lock the row and get current data
  SELECT * INTO v_paste
  FROM public.pastes
  WHERE key = paste_key
  FOR UPDATE;
  
  -- Check if paste exists
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Store previous view count
  v_prev_views := v_paste.views;
  
  -- Increment views
  UPDATE public.pastes
  SET views = views + 1
  WHERE key = paste_key;
  
  -- Return previous view count and paste data
  RETURN QUERY
  SELECT 
    v_prev_views,
    v_paste.id,
    v_paste.code,
    v_paste.views + 1,
    v_paste.created_at,
    v_paste.expires_at,
    v_paste.filename,
    v_paste.delete_after_view;
END;
$$;