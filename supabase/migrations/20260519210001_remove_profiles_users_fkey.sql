-- Remove foreign key constraint from profiles.id to auth.users
-- This allows profiles to be independent of Supabase Auth

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Make profiles.id independent (no longer references auth.users)
-- It will now be linked via auth_user_id column instead
