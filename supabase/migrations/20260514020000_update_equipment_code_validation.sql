-- Update equipment unique_code validation to new format
-- New format: 2 letters only (e.g., WE, CE, NE, IE, AM)
-- Old format: 2 letters + 2 digits (e.g., WE01, CE01, NE01, IE01, AM03)

-- Since database is reset, we can directly update the validation logic
-- The unique_code column already exists, we just need to update the constraint

-- First, remove the existing unique index if it exists
DROP INDEX IF EXISTS public.idx_equipments_unique_code;

-- Add a check constraint for the new format
ALTER TABLE public.equipments
ADD CONSTRAINT equipment_code_format_check 
CHECK (unique_code ~ '^[A-Z]{2}$');

-- Recreate unique index on unique_code
CREATE UNIQUE INDEX idx_equipments_unique_code ON public.equipments(unique_code);

-- Update comment for documentation
COMMENT ON COLUMN public.equipments.unique_code IS 'Equipment type code (e.g., WE, CE, NE, IE, AM). Manually entered by admin/encoder.';
