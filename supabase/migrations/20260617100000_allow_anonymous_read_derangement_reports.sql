-- Allow anonymous and authenticated read access to derangement_reports
-- Necessary because custom JWT used by standard client is recognized as 'anon' by Supabase

DROP POLICY IF EXISTS "Authenticated users can view derangement_reports" ON public.derangement_reports;
DROP POLICY IF EXISTS "Allow public read access to derangement_reports" ON public.derangement_reports;

CREATE POLICY "Allow public read access to derangement_reports"
    ON public.derangement_reports FOR SELECT
    TO anon, authenticated
    USING (true);

-- Also update storage policy for public access to the bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access to Derangement Reports" ON storage.objects;

CREATE POLICY "Public Read Access to Derangement Reports"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'derangement-reports');
