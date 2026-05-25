-- Migration: Ensure every authenticated user can always read their own profile row.
-- The existing "Users can view their own profile" policy should already cover this,
-- but this explicit recreation removes any ambiguity that may arise after the ENUM
-- type migration (20260505024100_add_enum_types.sql).

-- Drop and recreate to ensure the policy is clean and not affected by prior changes.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
