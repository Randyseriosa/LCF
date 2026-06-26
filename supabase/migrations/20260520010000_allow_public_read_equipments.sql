-- Allow public read access to equipments table
-- The system uses custom JWT authentication, not Supabase Auth
-- Edge functions use service role for writes (bypassing RLS)
-- Client reads use anon key with custom JWT, which Supabase doesn't recognize

DROP POLICY IF EXISTS "Authenticated users can view equipments" ON public.equipments;
DROP POLICY IF EXISTS "Public read access to equipments" ON public.equipments;

CREATE POLICY "Public read access to equipments"
    ON public.equipments FOR SELECT
    TO anon, authenticated
    USING (true);
