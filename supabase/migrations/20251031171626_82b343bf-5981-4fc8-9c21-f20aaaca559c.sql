-- Fix function search path security issue
DROP FUNCTION IF EXISTS public.cleanup_expired_pastes();

CREATE OR REPLACE FUNCTION public.cleanup_expired_pastes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pastes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;