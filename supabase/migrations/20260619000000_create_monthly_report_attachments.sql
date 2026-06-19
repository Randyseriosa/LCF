-- Create monthly_report_attachments table
CREATE TABLE IF NOT EXISTS public.monthly_report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    report_month DATE NOT NULL,
    file_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    imported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monthly_report_attachments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view attachments
CREATE POLICY "Authenticated users can view attachments" 
    ON public.monthly_report_attachments FOR SELECT TO authenticated 
    USING (true);

-- Create storage bucket for monthly report attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('monthly-report-attachments', 'monthly-report-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
-- Allow authenticated users to read files
CREATE POLICY "Public Access Monthly Report Attachments" 
    ON storage.objects FOR SELECT TO authenticated 
    USING (bucket_id = 'monthly-report-attachments');

-- Allow service role to manage files (already default)
