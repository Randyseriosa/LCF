-- Add equipment_type field to equipments table
-- This will distinguish between different equipment categories with specific field requirements

ALTER TABLE public.equipments
ADD COLUMN equipment_type TEXT;

-- Add check constraint for valid equipment types
ALTER TABLE public.equipments
ADD CONSTRAINT equipment_type_check 
CHECK (equipment_type IN ('weapon', 'communication', 'navigational', 'ict') OR equipment_type IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN public.equipments.equipment_type IS 'Type of equipment: weapon, communication, navigational, or ict. Each type has different field requirements in monthly reports.';
