-- Rename status to is_status in items table to avoid confusion with monthly_report_items.status
ALTER TABLE public.items RENAME COLUMN status TO is_status;

-- Update comment
COMMENT ON COLUMN public.items.is_status IS 'Lifecycle status of the item: active or retired. Used to distinguish from operational status in reports.';
