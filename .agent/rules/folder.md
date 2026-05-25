---
trigger: always_on
---

# Project Folder Architecture

## 1. Core Directory Rules
Follow a feature-based modular structure. All new components or logic should reside within the most relevant directory.

* src/components/: Atomic, reusable UI components (e.g., buttons, inputs).
* src/features/: Group logic, components, and hooks by domain (e.g., features/auth, features/admin).
* src/hooks/: Global, reusable React hooks.
* src/lib/: Third-party configurations (e.g., supabaseClient.js).
* src/services/: Pure logic for API calls or database queries.
* supabase/migrations/: All SQL migration files.

## 2. Structure Map
src/
├── assets/          # Static files
├── components/      # Shared UI
│   ├── ui/          # Component wrappers
│   └── layout/      # Shared layout parts
├── features/        # Domain-driven modules
│   ├── profile/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.js
├── hooks/           # Global hooks
├── lib/             # SDK/Config
├── services/        # API logic
└── utils/           # Helpers

## 3. Naming & Standards
* Components: PascalCase (e.g., AdminPanel.jsx).
* Hooks/Utils: camelCase (e.g., useUserRole.js).
* Exports: Use named exports for better IDE support.
* Logic: Place business logic in custom hooks within the feature folder.