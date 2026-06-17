-- Create derangement_reports table
CREATE TABLE IF NOT EXISTS public.derangement_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    report_month DATE NOT NULL,
    file_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    imported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.derangement_reports ENABLE ROW LEVEL SECURITY;

-- Enable Public/Authenticated Read
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'derangement_reports' AND policyname = 'Authenticated users can view derangement_reports'
    ) THEN
        CREATE POLICY "Authenticated users can view derangement_reports" 
            ON public.derangement_reports FOR SELECT TO authenticated 
            USING (true);
    END IF;
END $$;

-- Create storage bucket for derangement reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('derangement-reports', 'derangement-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
-- Allow authenticated users to read files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'derangement-reports');

-- Allow authenticated users to upload files (usually done via service role in edge functions, but we can add this for safety if needed)
-- Actually, the edge function will use service_role, so it doesn't need public policies for upload.
