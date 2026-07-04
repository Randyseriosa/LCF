-- Add unserviceable_at and unassigned_at columns to items table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS unserviceable_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMP WITH TIME ZONE;

-- Create or update trigger to manage these columns automatically
CREATE OR REPLACE FUNCTION public.handle_item_dates_and_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle unserviceable_at (when is_status is updated to 'retired')
    IF NEW.is_status = 'retired' THEN
        IF OLD IS NULL OR OLD.is_status IS DISTINCT FROM 'retired' OR NEW.unserviceable_at IS NULL THEN
            NEW.unserviceable_at = now();
        END IF;
    ELSE
        NEW.unserviceable_at = NULL;
    END IF;

    -- Handle unassigned_at (when current_assignment_id becomes null or item is created with null assignment)
    IF NEW.is_status = 'active' AND NEW.current_assignment_id IS NULL THEN
        IF OLD IS NULL OR OLD.current_assignment_id IS NOT NULL OR NEW.unassigned_at IS NULL THEN
            NEW.unassigned_at = now();
        END IF;
    ELSE
        -- If it is assigned or becomes retired
        NEW.unassigned_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to run BEFORE INSERT OR UPDATE on public.items
DROP TRIGGER IF EXISTS tr_items_dates_and_status ON public.items;
CREATE TRIGGER tr_items_dates_and_status
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.handle_item_dates_and_status();

-- Update existing values in the database
UPDATE public.items
SET unserviceable_at = COALESCE(updated_at, created_at, now())
WHERE is_status = 'retired';

UPDATE public.items
SET unassigned_at = COALESCE(updated_at, created_at, now())
WHERE is_status = 'active' AND current_assignment_id IS NULL;
