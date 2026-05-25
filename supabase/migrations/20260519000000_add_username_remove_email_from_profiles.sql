-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;

-- Drop the NOT NULL constraint on email (will be removed later)
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- Backfill username from existing email (before removing email)
UPDATE public.profiles SET username = email WHERE username IS NULL;

-- Remove email column from profiles (email already exists in auth.users)
ALTER TABLE public.profiles DROP COLUMN email;
