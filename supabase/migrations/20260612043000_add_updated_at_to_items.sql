-- Add updated_at column to items table and set up a trigger to update it automatically
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tr_items_updated_at ON public.items;
CREATE TRIGGER tr_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update existing rows to have updated_at match created_at initially (or remain as now() default)
UPDATE public.items SET updated_at = created_at WHERE updated_at IS NULL;
