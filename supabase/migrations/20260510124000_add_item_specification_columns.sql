-- Add item specification columns to items table
-- These columns serve as the master catalog for all possible items

-- Add specification columns to items table
ALTER TABLE public.items
ADD COLUMN unique_code TEXT UNIQUE,
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

-- Add comments for documentation
COMMENT ON COLUMN public.items.unique_code IS 'Unique identifier for import matching (e.g., PS177-W1-00001)';
COMMENT ON COLUMN public.items.classification IS 'Category within equipment type';
COMMENT ON COLUMN public.items.nomenclature IS 'Standard name/identifier';
COMMENT ON COLUMN public.items.brand IS 'Manufacturer';
COMMENT ON COLUMN public.items.model IS 'Model number';
COMMENT ON COLUMN public.items.serial_number IS 'Manufacturer serial number (static reference)';
COMMENT ON COLUMN public.items.part_number IS 'Manufacturer part number';
COMMENT ON COLUMN public.items.date_manufactured IS 'Manufacturing date (static reference)';
COMMENT ON COLUMN public.items.date_installed_issued IS 'Date installed/issued (static reference)';
COMMENT ON COLUMN public.items.ics IS 'Inventory Custodian Slip (fixed reference)';
COMMENT ON COLUMN public.items.par IS 'Property Acknowledgement Receipt (fixed reference)';
