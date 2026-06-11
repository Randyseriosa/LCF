-- Add status column to items table to track active and retired items
ALTER TABLE public.items
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired'));

-- Add index for status
CREATE INDEX idx_items_status ON public.items(status);

-- Add comment for documentation
COMMENT ON COLUMN public.items.status IS 'Status of the item: active or retired. Unassigned items are active items without a vessel_id.';
