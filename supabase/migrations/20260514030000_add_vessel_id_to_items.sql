-- Add vessel_id column to items table for direct vessel reference
-- This enables item code generation with vessel context (TYPE_CODE-BOW_NUMBER-SEQUENCE)

ALTER TABLE public.items
ADD COLUMN vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL;

-- Add index for performance on vessel_id
CREATE INDEX idx_items_vessel_id ON public.items(vessel_id);

-- Add comment for documentation
COMMENT ON COLUMN public.items.vessel_id IS 'Direct reference to vessel for item code generation and tracking. Items can be assigned to vessels via vessel_item_assignments table.';

-- Update items.unique_code comment to reflect new format
COMMENT ON COLUMN public.items.unique_code IS 'Unique identifier for import matching with new format: TYPE_CODE-BOW_NUMBER-SEQUENCE (e.g., WE01-PS177-001)';
