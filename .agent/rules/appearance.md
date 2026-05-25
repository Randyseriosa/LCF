---
trigger: always_on
---

Implementation Guidelines
1. Utility-First Styling: Use Tailwind classes directly in the markup. Avoid using @apply in CSS files; keep styles co-located with the HTML/JSX.

2. Snow UI Composition: Always check the Snow UI library for a pre-built component (e.g., Button, Modal, DataGrid) before building from scratch.

3. Design Token Adherence: Use the theme-specific spacing, colors, and shadows defined in the tailwind.config.js. Do not use "magic numbers" like top-[13px]; use standard scales like top-3.

4. Responsive Design: Use Tailwind’s mobile-first breakpoints (e.g., md:, lg:) to ensure Snow UI components scale correctly across devices.

5. Semantic HTML: Ensure that Snow UI components are wrapped in semantic HTML tags (<main>, <section>, <nav>) styled via Tailwind for layout.