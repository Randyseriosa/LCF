-- Add sync_status column to monthly_report_items table
-- This column tracks whether the static column values match with the masterlist or previous report

ALTER TABLE public.monthly_report_items
ADD COLUMN sync_status TEXT CHECK (sync_status IN ('matched', 'mismatched', 'not_checked'));

COMMENT ON COLUMN public.monthly_report_items.sync_status IS 'Sync status: matched if static columns match masterlist/previous report, mismatched if they differ, not_checked if not yet validated';
