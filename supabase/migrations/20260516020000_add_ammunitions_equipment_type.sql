-- Add AMMUNITIONS to equipment_type enum
-- This will support ammunition equipment with quantity tracking

-- Drop existing check constraint
ALTER TABLE public.equipments
DROP CONSTRAINT IF EXISTS equipment_type_check;

-- Add new check constraint with AMMUNITIONS
ALTER TABLE public.equipments
ADD CONSTRAINT equipment_type_check 
CHECK (equipment_type IN ('weapon', 'communication', 'navigational', 'ict', 'ammunitions') OR equipment_type IS NULL);

-- Update comment
COMMENT ON COLUMN public.equipments.equipment_type IS 'Type of equipment: weapon, communication, navigational, ict, or ammunitions. Each type has different field requirements in monthly reports.';
