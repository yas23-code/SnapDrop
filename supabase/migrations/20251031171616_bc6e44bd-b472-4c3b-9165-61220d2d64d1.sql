-- Create pastes table for code sharing
CREATE TABLE public.pastes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE public.pastes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Anyone can create pastes" 
ON public.pastes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view pastes" 
ON public.pastes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can update pastes (for view counter)" 
ON public.pastes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete pastes" 
ON public.pastes 
FOR DELETE 
USING (true);

-- Create index on key for faster lookups
CREATE INDEX idx_pastes_key ON public.pastes(key);

-- Create index on expires_at for cleanup operations
CREATE INDEX idx_pastes_expires_at ON public.pastes(expires_at);

-- Function to clean up expired pastes
CREATE OR REPLACE FUNCTION public.cleanup_expired_pastes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pastes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;