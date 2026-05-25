---
trigger: always_on
---

All CREATE, UPDATE, and DELETE operations must be executed via Edge Functions. Direct client-side database mutations are strictly prohibited to ensure data integrity, server-side validation, and security.

READ operations may be performed directly from the frontend (e.g., using a client SDK) to minimize latency and leverage client-side caching, provided appropriate Row Level Security (RLS) is active.