-- Allow service role to manage profiles (for edge functions)
-- This is needed for manage-user edge function to create profiles
CREATE POLICY "Service role can manage profiles"
ON public.profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
