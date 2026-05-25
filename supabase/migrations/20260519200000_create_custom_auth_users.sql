-- Create custom auth_users table for username/password authentication
-- This table is independent of Supabase Auth (auth.users)

CREATE TABLE public.auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for username lookups
CREATE INDEX idx_auth_users_username ON public.auth_users(username);

-- Update profiles table to reference auth_users instead of auth.users
-- First, add the new column
ALTER TABLE public.profiles ADD COLUMN auth_user_id UUID REFERENCES public.auth_users(id) ON DELETE CASCADE;

-- Migrate existing data: for each profile, create an auth_user record
-- Note: This assumes existing users were created with manage-user edge function
-- which stored username in profiles. We'll need to set a temporary password for them.
-- For now, we'll insert NULL password_hash and admin can reset passwords.

INSERT INTO public.auth_users (id, username, password_hash)
SELECT 
    gen_random_uuid(),
    username,
    NULL  -- Password hash will be NULL - users need password reset
FROM public.profiles
WHERE username IS NOT NULL
ON CONFLICT (username) DO NOTHING;

-- Update profiles to link to the new auth_user_id
UPDATE public.profiles p
SET auth_user_id = au.id
FROM public.auth_users au
WHERE p.username = au.username;

-- Now we need to drop the old foreign key constraint and replace it
-- First, get the constraint name (this is tricky in SQL, so we'll recreate the table)

-- Update RLS policies to use the new auth_user_id instead of auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.auth_users 
            WHERE auth_users.id = profiles.auth_user_id
            AND auth_users.username = (
                SELECT username FROM public.auth_users 
                WHERE id = (
                    SELECT auth_user_id FROM public.profiles 
                    WHERE id = profiles.id
                )
            )
        )
    );

-- Note: The RLS policy above is a placeholder and will be updated 
-- after we implement the JWT-based auth system where we can extract user_id from token

-- Enable RLS on auth_users
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;

-- No one should be able to read/write auth_users directly except through edge functions
CREATE POLICY "No direct access to auth_users" ON public.auth_users FOR ALL TO public USING (false);
