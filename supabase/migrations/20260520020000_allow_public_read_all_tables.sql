-- Allow public read access to all tables for custom JWT authentication
-- The system uses custom JWT authentication (JWT_SECRET), not Supabase Auth
-- Edge functions use service role for writes (bypassing RLS)
-- Client reads use anon key with custom JWT, which Supabase doesn't recognize as authenticated

-- Vessels
DROP POLICY IF EXISTS "Authenticated users can view vessels" ON public.vessels;
CREATE POLICY "Public read access to vessels"
    ON public.vessels FOR SELECT
    TO anon, authenticated
    USING (true);

-- Items
DROP POLICY IF EXISTS "Authenticated users can view items" ON public.items;
CREATE POLICY "Public read access to items"
    ON public.items FOR SELECT
    TO anon, authenticated
    USING (true);

-- Class of Vessel
DROP POLICY IF EXISTS "Authenticated users can view class_of_vessel" ON public.class_of_vessel;
CREATE POLICY "Public read access to class_of_vessel"
    ON public.class_of_vessel FOR SELECT
    TO anon, authenticated
    USING (true);

-- Vessel Item Assignments
DROP POLICY IF EXISTS "Authenticated users can view vessel_item_assignments" ON public.vessel_item_assignments;
CREATE POLICY "Public read access to vessel_item_assignments"
    ON public.vessel_item_assignments FOR SELECT
    TO anon, authenticated
    USING (true);

-- Monthly Reports
DROP POLICY IF EXISTS "Authenticated users can view monthly_reports" ON public.monthly_reports;
CREATE POLICY "Public read access to monthly_reports"
    ON public.monthly_reports FOR SELECT
    TO anon, authenticated
    USING (true);

-- Monthly Report Items
DROP POLICY IF EXISTS "Authenticated users can view monthly_report_items" ON public.monthly_report_items;
CREATE POLICY "Public read access to monthly_report_items"
    ON public.monthly_report_items FOR SELECT
    TO anon, authenticated
    USING (true);
