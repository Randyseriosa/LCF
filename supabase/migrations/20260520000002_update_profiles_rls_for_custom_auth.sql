-- Update RLS policies for profiles to work with custom JWT auth
-- Since custom JWT doesn't set auth.uid(), we allow all authenticated users to read
-- Authorization is handled at the application layer via middleware

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Allow authenticated users to read all profiles
-- Allow authenticated/anon users to read all profiles for custom JWT auth
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read access to profiles" ON public.profiles;
CREATE POLICY "Public read access to profiles"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);
