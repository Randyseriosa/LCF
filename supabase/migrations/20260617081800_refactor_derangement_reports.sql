-- Refactor derangement reports: add item_id to link reports to specific items
-- and create a junction table for multiple PDF files per derangement report item

-- Add item_id to derangement_reports to associate a report with a specific item
ALTER TABLE public.derangement_reports
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.items(id) ON DELETE CASCADE;

-- Add remarks column to derangement_reports
ALTER TABLE public.derangement_reports
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Create index for performance on item_id lookups
CREATE INDEX IF NOT EXISTS idx_derangement_reports_item_id ON public.derangement_reports(item_id);
CREATE INDEX IF NOT EXISTS idx_derangement_reports_vessel_id ON public.derangement_reports(vessel_id);
CREATE INDEX IF NOT EXISTS idx_derangement_reports_report_month ON public.derangement_reports(report_month);
