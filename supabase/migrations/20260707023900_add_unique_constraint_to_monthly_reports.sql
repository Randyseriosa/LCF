-- Delete duplicate monthly reports, keeping the latest one
DELETE FROM public.monthly_reports
WHERE id NOT IN (
    SELECT DISTINCT ON (vessel_id, report_month) id
    FROM public.monthly_reports
    ORDER BY vessel_id, report_month, created_at DESC
);

-- Add unique constraint to prevent duplicate reports for the same vessel and month
ALTER TABLE public.monthly_reports
ADD CONSTRAINT unique_vessel_report_month UNIQUE (vessel_id, report_month);
