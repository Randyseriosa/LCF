---
trigger: always_on
---

Core Security Principles
1. Deny by Default: Every new table must immediately have RLS enabled. Without a policy, all operations (Select, Insert, Update, Delete) must fail by default.

2. Authenticated-Only Access: Never use true for public access unless the data is explicitly intended for anonymous users. Use TO authenticated to restrict policies to logged-in users.

3. Service Role Isolation: The service_role key must never be used in the frontend. It is reserved for administrative backend tasks (Edge Functions, Cron jobs) as it bypasses all RLS.

4. Use auth.uid(): Always anchor ownership-based policies to the Supabase internal auth.uid() function to ensure the user can only touch their own data.

5. Performance-First Policies: Columns used in RLS filters (like user_id or org_id) must be indexed to avoid full table scans on every request.