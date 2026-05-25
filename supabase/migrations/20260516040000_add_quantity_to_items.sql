-- Add quantity column to items table for AMMUNITIONS equipment type
-- This will track quantity for ammunition items

ALTER TABLE public.items
ADD COLUMN quantity INTEGER;

COMMENT ON COLUMN public.items.quantity IS 'Quantity of items - AMMUNITIONS equipment type only (dynamic, nullable)';
