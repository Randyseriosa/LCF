---
trigger: always_on
---

Implementation Guidelines
1. No Implicit Numerics: Never define an enum without explicit values. Implicitly incrementing integers lead to brittle code and mapping errors during refactors.

2. Prefer String Enums: When an enum is necessary, use explicit strings to ensure logs and serialized data remain human-readable.

3. Use as const for Type Sets: For maximum type safety and to avoid the overhead of Enums, use object literals with a const assertion.

4. Exhaustiveness Checking: Always use the never type in switch statements to ensure all members are handled.