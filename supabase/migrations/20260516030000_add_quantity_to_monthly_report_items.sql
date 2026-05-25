-- Add quantity column back to monthly_report_items table for AMMUNITIONS equipment type
-- This will track quantity for ammunition items in monthly reports

ALTER TABLE public.monthly_report_items
ADD COLUMN quantity INTEGER;

COMMENT ON COLUMN public.monthly_report_items.quantity IS 'Quantity of items - AMMUNITIONS equipment type only (dynamic, nullable)';
