---
trigger: always_on
---

All categorical data types with a fixed set of allowed values must be defined as an enum. Functions must type-hint the enum class rather than primitives (strings/ints) to ensure compile-time or static-analysis safety.