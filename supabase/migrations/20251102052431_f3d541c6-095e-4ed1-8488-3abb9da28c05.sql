-- Add delete_after_view column to pastes table
ALTER TABLE public.pastes ADD COLUMN delete_after_view BOOLEAN DEFAULT false;