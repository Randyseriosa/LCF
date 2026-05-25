-- Migration: Allow admin role to read all profiles (except their own, filtered client-side)
-- Context: The existing "Users can view their own profile" policy only allows self-reads.
-- Admins need to see all user profiles to manage roles and activation status.

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
    );
