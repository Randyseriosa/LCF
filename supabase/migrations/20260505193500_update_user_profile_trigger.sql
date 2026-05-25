-- Update function to handle new user insertion with name and avatar_url
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role, is_active)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'viewer', -- default
    'inactive' -- default inactive
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
