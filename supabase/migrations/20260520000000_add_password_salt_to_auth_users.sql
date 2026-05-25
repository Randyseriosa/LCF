-- Add per-user password salt for stronger credential storage.
-- Existing admin record is re-hashed with a deterministic salt so
-- the seeded password (Admin@123) continues to work after migration.

ALTER TABLE public.auth_users
    ADD COLUMN IF NOT EXISTS password_salt TEXT;

-- Re-hash the seeded admin using pgcrypto with its own random salt.
-- gen_random_uuid() produces a unique salt every migration run.
DO $$
DECLARE
    v_salt TEXT := gen_random_uuid()::TEXT;
BEGIN
    UPDATE public.auth_users
    SET
        password_salt  = v_salt,
        password_hash  = encode(digest(v_salt || ':Admin@123', 'sha256'), 'hex')
    WHERE username = 'admin'
      AND password_salt IS NULL;
END $$;
