-- Migration: Replace TEXT + CHECK constraints with native PostgreSQL ENUM types
-- for profiles.role, profiles.is_active, and items.is_spare.
--
-- Per memory rule: never modify existing migration files — this is a new migration
-- that overrides/replaces the TEXT-based definitions from 20260504172333_init_schema.sql.

-- ============================================================
-- 1. Create ENUM types
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('admin', 'encoder', 'viewer');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');
CREATE TYPE public.item_type AS ENUM ('standard', 'spare');

-- ============================================================
-- 2. Migrate profiles.role  TEXT → user_role
-- ============================================================

-- Drop the old CHECK constraint first
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.profiles
    ALTER COLUMN role TYPE public.user_role
    USING role::public.user_role;

ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'viewer'::public.user_role;

-- ============================================================
-- 3. Migrate profiles.is_active  TEXT → user_status
-- ============================================================

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_is_active_check;

ALTER TABLE public.profiles
    ALTER COLUMN is_active DROP DEFAULT;

ALTER TABLE public.profiles
    ALTER COLUMN is_active TYPE public.user_status
    USING is_active::public.user_status;

ALTER TABLE public.profiles
    ALTER COLUMN is_active SET DEFAULT 'inactive'::public.user_status;

-- ============================================================
-- 4. Migrate items.is_spare  TEXT → item_type
-- ============================================================

ALTER TABLE public.items
    DROP CONSTRAINT IF EXISTS items_is_spare_check;

ALTER TABLE public.items
    ALTER COLUMN is_spare DROP DEFAULT;

ALTER TABLE public.items
    ALTER COLUMN is_spare TYPE public.item_type
    USING is_spare::public.item_type;

ALTER TABLE public.items
    ALTER COLUMN is_spare SET DEFAULT 'standard'::public.item_type;
