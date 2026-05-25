-- Remove name and is_spare columns from items table

-- Drop the name column
ALTER TABLE public.items DROP COLUMN IF EXISTS name;

-- Drop the is_spare column
ALTER TABLE public.items DROP COLUMN IF EXISTS is_spare;
