-- Seed initial admin user
-- Username: admin
-- Password: Admin@123
-- Profile will be auto-created on first login via auth-login edge function

-- Hash the password using SHA-256 (matching the auth-signup edge function)
-- The hash for "Admin@123" is computed as: SHA-256("Admin@123")

INSERT INTO auth_users (username, password_hash, created_at) 
VALUES (
    'admin',
    encode(digest('Admin@123', 'sha256'), 'hex'),
    now()
) ON CONFLICT (username) DO NOTHING;
