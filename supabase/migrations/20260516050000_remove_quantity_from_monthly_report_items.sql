-- Remove quantity column from monthly_report_items table
-- Reverting the addition of quantity column for AMMUNITIONS equipment type
ALTER TABLE public.monthly_report_items DROP COLUMN quantity;
