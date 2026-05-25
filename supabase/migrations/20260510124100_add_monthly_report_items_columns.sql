-- Add columns to monthly_report_items table for denormalized approach
-- This captures a snapshot of item specifications at import time for historical accuracy

-- Add static snapshot columns (copied from items at import time)
ALTER TABLE public.monthly_report_items
ADD COLUMN unique_code TEXT,
ADD COLUMN classification TEXT,
ADD COLUMN nomenclature TEXT,
ADD COLUMN brand TEXT,
ADD COLUMN model TEXT,
ADD COLUMN serial_number TEXT,
ADD COLUMN part_number TEXT,
ADD COLUMN date_manufactured DATE,
ADD COLUMN date_installed_issued DATE,
ADD COLUMN ics TEXT,
ADD COLUMN par TEXT;

-- Add dynamic columns (state-specific data)
ALTER TABLE public.monthly_report_items
ADD COLUMN date_last_pms DATE,
ADD COLUMN date_last_repair DATE,
ADD COLUMN running_hours INTEGER,
ADD COLUMN status TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.monthly_report_items.unique_code IS 'Matching key for import (copied from items at import time)';
COMMENT ON COLUMN public.monthly_report_items.classification IS 'Category within equipment type (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.nomenclature IS 'Standard name/identifier (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.brand IS 'Manufacturer (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.model IS 'Model number (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.serial_number IS 'Manufacturer serial number (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.part_number IS 'Manufacturer part number (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.date_manufactured IS 'Manufacturing date (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.date_installed_issued IS 'Date installed/issued (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.ics IS 'Inventory Custodian Slip (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.par IS 'Property Acknowledgement Receipt (historical snapshot)';
COMMENT ON COLUMN public.monthly_report_items.date_last_pms IS 'Date of Last Preventive Maintenance Service (dynamic)';
COMMENT ON COLUMN public.monthly_report_items.date_last_repair IS 'Date of Last Repair (dynamic)';
COMMENT ON COLUMN public.monthly_report_items.running_hours IS 'Running hours - Navigational Sensors only (dynamic, nullable)';
COMMENT ON COLUMN public.monthly_report_items.status IS 'Current operational status (dynamic)';
