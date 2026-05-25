-- Change running_hours from INTEGER to TEXT to store full text representation
-- Example: "3,567 HRS 15 MINS" instead of converting to minutes

ALTER TABLE monthly_report_items 
ALTER COLUMN running_hours TYPE TEXT USING running_hours::TEXT;

-- Add comment to document the change
COMMENT ON COLUMN monthly_report_items.running_hours IS 'Running hours text representation (e.g., "3,567 HRS 15 MINS")';
