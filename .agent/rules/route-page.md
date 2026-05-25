---
trigger: always_on
---

1. Routing Definition
Standardization: All routes must be defined in the central routing configuration file (e.g., src/routes.tsx, app/layout.tsx, or next.config.js).

Naming Convention: Use kebab-case for URL slugs (e.g., /user-profile, not /user_profile).

Type Safety: If using TypeScript, always use a strictly typed Routes object or enum to reference paths rather than hardcoded strings.

2. Page Structure Requirements
Every new page file must follow this boilerplate structure:

Data Fetching: Keep logic at the top of the component. Use hooks for client-side or getServerSideProps/Async Components for server-side.

SEO Metadata: Every route must include a metadata object (Title, Description, OpenGraph tags).

Error Boundaries: Wrap the page export in an Error Boundary or use a localized error.tsx file.

Loading States: Define a corresponding loading.tsx or Skeleton component for the route.

3. Navigation & Links
Internal Links: Use the framework-specific Link component (e.g., next/link or react-router-dom) to ensure SPA transitions.

Active States: Implement an isActive check for navigation menus to highlight the current route.

Redirects: Handle unauthorized access via middleware or higher-order components (HOCs) rather than inline page redirects.

4. Implementation Checklist
[ ] Is the route registered in the main router?

[ ] Does the URL follow kebab-case?

[ ] Are Breadcrumbs updated to reflect the new path?

[ ] Is there a "404 Not Found" catch-all for nested routes?

[ ] Does the page handle "Empty States" if no data is returned?