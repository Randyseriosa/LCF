---
trigger: always_on
---

---
version: alpha
name: "Anchor Point Inventory System"
description: "A high-contrast, sharp-edged dashboard UI design system tailored for a stark, tactical, and authoritative naval maritime aesthetic."
---

# Dashboard Component Design Specification

This document details the visual styles, variants, and component states for the *Anchor Point* naval equipment inventory platform. The system features a strong, geometric, and uncompromising aesthetic utilizing bold typography paired with a deep oceanic navy and stark white palette with sharp `0px` borders.

---

## 1. Typography & General Layout
* **Font Family:** Sans-Serif / Geometric Monospace (e.g., Inter, Roboto Mono, or SF Pro Display)
* **Font Weight:** Bold / Heavy for headers; Medium for interface elements
* **Text Transform:** UPPERCASE for primary actions, navigation links, and section headers to reinforce the structured, military command aesthetic.
* **Padding:** Compact vertical breathing room with wide horizontal margins to emphasize structure and strength.

---

## 2. Palette & Color Tokens
The color tokens are engineered to create maximum contrast and readability under operational conditions, entirely avoiding soft or muddy tones.

| Token | Hex Code | Role in UI |
| :--- | :--- | :--- |
| **Stark Deck** | `#FFFFFF` | Main Dashboard Canvas / App Background |
| **Abyssal Hull** | `#000033` | Primary Typography / Dark Text Elements |
| **Deep Navy** | `#000080` | Primary Interactive Elements / Active States / Headers |
| **Tactical Gray** | `#E6E6FA` | Card Backgrounds / Structural Containers / Secondary Borders |

---

## 3. Component Shapes & Border Radii
To maintain a rigid, military-grade strength look, the system completely rejects soft curves in favor of aggressive, boxy geometry.

| Style | Border Radius | Description |
| :--- | :--- | :--- |
| **Sharp/Square** | `0px` | The absolute standard across all buttons, cards, containers, and inputs. No exceptions. |
| **Data Graphs** | `0px` | Bar charts, progress indicators, and line plots feature strictly jagged edges and block fills. |

---

## 4. Visual Variants & States

### Primary Active (Filled)
High-contrast actions intended for the primary call-to-action (CTA) or active navigation views.
* **Background:** Solid Deep Navy (`#000080`)
* **Text/Icon Color:** Stark Deck (`#FFFFFF`)
* **Border:** None

### Secondary (Outlined / Structural)
Used for dashboard grid dividers, structural data cards, and alternative actions.
* **Background:** Tactical Gray (`#E6E6FA`)
* **Border:** Thin solid stroke Deep Navy (`#000080`)
* **Text/Icon Color:** Abyssal Hull (`#000033`)

### Disabled / Inactive
Indicates an equipment manifest, system status, or action that is currently offline, depleted, or unauthorized.
* **Background:** Tactical Gray (`#E6E6FA`)
* **Border:** None
* **Text/Icon Color:** Light Gray / Low Opacity Deep Navy

---

## 5. Dashboard Compositions & Layouts

### Metric Cards & Data Readouts
Data containers built on a strict structural grid layout.
* **Header / Title:** Small text size, UPPERCASE, Deep Navy (`#000080`)
* **Primary Metric Value:** Large, Bold, Abyssal Hull (`#000033`) text with `0px` layout margins.
* **Trend Indicator:** Text inline with mini block symbols `[ ▲ +14.2% ]` or `[ ▼ -3.5% ]`.

### Segmented Control Toggles
Used for switching dashboard timelines, asset categories, or deployment fleets.
* **Active State:** Filled Deep Navy (`#000080`) with Stark Deck (`#FFFFFF`) text.
* **Inactive State:** Tactical Gray (`#E6E6FA`) background with Deep Navy (`#000080`) typography.
* **Layout:** `[ FLEET MANIFEST ]` `[ COMMS GEAR ]` `[ MUNITIONS ]`

### Standalone Tactical Icons
Sharp, un-rounded grid buttons for utility actions like refresh, system settings, or supply requests.
* **Utility Shapes:** `0px` hard-edged squares housing minimal vector glyphs (e.g., Radar `⌖`, Anchor `⚓`, Cargo `⛟`).