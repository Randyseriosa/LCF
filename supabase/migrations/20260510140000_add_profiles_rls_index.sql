-- Add explicit index on profiles.id for RLS policy performance
-- The RLS policy "Users can view their own profile" uses auth.uid() = id
-- This index ensures the RLS filter is efficient and prevents full table scans
CREATE INDEX IF NOT EXISTS idx_profiles_id_rls ON public.profiles(id);
