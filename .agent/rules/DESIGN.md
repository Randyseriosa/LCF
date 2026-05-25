---
trigger: always_on
---

---
version: alpha
name: "Verdant Forge Dashboard System"
description: "A high-contrast, sharp-edged dashboard UI design system tailored for a bold, masculine, and minimalist green aesthetic."
---

# Dashboard Component Design Specification

This document details the visual styles, variants, and component states for the *Verdant Forge* dashboard. The system features a strong, geometric, and uncompromising aesthetic utilizing bold typography paired with a deep, militaristic green palette and sharp `0px` borders.

---

## 1. Typography & General Layout
* **Font Family:** Sans-Serif / Geometric Monospace (e.g., Inter, Roboto Mono, or SF Pro Display)
* **Font Weight:** Bold / Heavy for headers; Medium for interface elements
* **Text Transform:** UPPERCASE for primary actions, navigation links, and section headers to reinforce the bold, masculine aesthetic.
* **Padding:** Compact vertical breathing room with wide horizontal margins to emphasize structure and strength.

---

## 2. Palette & Color Tokens
The color tokens are engineered to create deep contrast without feeling soft or pastel.

| Token | Hex Code | Role in UI |
| :--- | :--- | :--- |
| **Deep Void** | `#18230F` | Main Dashboard Canvas / App Background |
| **Forest Shadow** | `#27391C` | Card Backgrounds / Containers / Secondary Borders |
| **Tactical Green** | `#255F38` | Primary Interactive Elements / Active States |
| **Cyber Moss** | `#1F7D53` | Accent Highlighting / Success States / Data Terminals |

---

## 3. Component Shapes & Border Radii
To maintain a rigid, minimal strength look, the system completely rejects soft curves in favor of aggressive, boxy geometry.

| Style | Border Radius | Description |
| :--- | :--- | :--- |
| **Sharp/Square** | `0px` | The absolute standard across all buttons, cards, containers, and inputs. No exceptions. |
| **Data Graphs** | `0px` | Bar charts, progress indicators, and line plots feature strictly jagged edges and block fills. |

---

## 4. Visual Variants & States

### Primary Active (Filled)
High-contrast actions intended for the primary call-to-action (CTA) or active navigation views.
* **Background:** Solid Cyber Moss (`#1F7D53`)
* **Text/Icon Color:** Deep Void (`#18230F`)
* **Border:** None

### Secondary (Outlined / Structural)
Used for dashboard grid dividers, structural data cards, and alternative actions.
* **Background:** Forest Shadow (`#27391C`)
* **Border:** Thin solid stroke Tactical Green (`#255F38`)
* **Text/Icon Color:** Solid White or High-Opacity Light Gray

### Disabled / Inactive
Indicates a metric, system status, or action that is currently offline or unauthorized.
* **Background:** Deep Void (`#18230F`)
* **Border:** Thin solid stroke Forest Shadow (`#27391C`)
* **Text/Icon Color:** Muted Milspec Gray / Low Opacity Green

---

## 5. Dashboard Compositions & Layouts

### Metric Cards & Data Readouts
Data containers built on a strict structural grid layout.
* **Header / Title:** Small text size, UPPERCASE, Cyber Moss (`#1F7D53`)
* **Primary Metric Value:** Large, Bold, White (`#FFFFFF`) text with `0px` layout margins.
* **Trend Indicator:** Text inline with mini block symbols `[ ▲ +14.2% ]` or `[ ▼ -3.5% ]`.

### Segmented Control Toggles
Used for switching dashboard timelines, system modules, or server views.
* **Active State:** Filled Tactical Green (`#255F38`) with Deep Void text.
* **Inactive State:** Deep Void background with Forest Shadow borders.
* **Layout:** `[ SYSTEM OVERVIEW ]` `[ NETWORK TRAFFIC ]` `[ SECURITY LOGS ]`

### Standalone Tactical Icons
Sharp, un-rounded grid buttons for utility actions like refresh, system settings, or terminal commands.
* **Utility Shapes:** `0px` hard-edged squares housing minimal vector glyphs (e.g., Terminal `>_`, Security `⚿`, Refresh `↻`).