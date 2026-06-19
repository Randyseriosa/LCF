-- Allow public read access to monthly_report_attachments and storage
-- Matches the project's custom JWT authentication pattern

-- Table: monthly_report_attachments
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.monthly_report_attachments;
CREATE POLICY "Public read access to monthly_report_attachments"
    ON public.monthly_report_attachments FOR SELECT
    TO anon, authenticated
    USING (true);

-- Storage: monthly-report-attachments bucket
DROP POLICY IF EXISTS "Public Access Monthly Report Attachments" ON storage.objects;
CREATE POLICY "Public Access Monthly Report Attachments"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'monthly-report-attachments');
