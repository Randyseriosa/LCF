-- Remove the handle_new_user trigger since we no longer use Supabase Auth
-- Custom auth system uses auth_users table instead of auth.users

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
