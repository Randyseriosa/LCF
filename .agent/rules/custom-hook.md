---
trigger: always_on
---

Extract shared logic into custom hooks named useSomething. This centralizes Supabase queries, realtime subscriptions, and role checks, avoiding duplicated fetches across dashboards and calendars.