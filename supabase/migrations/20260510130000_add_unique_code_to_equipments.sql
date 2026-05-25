-- Add unique_code field to equipments table with unique index
-- This code will be used to categorize imported items

ALTER TABLE public.equipments
ADD COLUMN unique_code TEXT;

-- Create unique index on unique_code to ensure no duplicates
CREATE UNIQUE INDEX idx_equipments_unique_code ON public.equipments(unique_code);

-- Add comment for documentation
COMMENT ON COLUMN public.equipments.unique_code IS 'Unique identifier code for equipment, used for categorizing imported items from Excel files';
