-- Allow public (anon and authenticated) read access to profiles table for custom JWT authentication
-- This ensures joined queries can fetch importer names in the Recent Imports list

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read access to profiles" ON public.profiles;

CREATE POLICY "Public read access to profiles"
    ON public.profiles FOR SELECT
    TO anon, authenticated
    USING (true);
