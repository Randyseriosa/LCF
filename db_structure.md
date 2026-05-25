# Database Structure

Based on the requirements outlined in the architecture, here is the database schema illustrating the tables, their primary keys (PK), and foreign keys (FK) to establish the correct parent-child relationships. 

We split this into three main domain areas: **Users & Auth**, **Core Master Data**, and **Monthly Report Data**.

### 1. Users & Auth

Stores the users, their roles, and their active status. This will hook into Supabase's built-in `auth.users`.

**Table: `profiles` (or `users`)**
*   **`id`** (UUID, PK) - Maps as a Foreign Key to `auth.users.id`.
*   **`email`** (String)
*   **`role`** (String) - Defined as `'admin'`, `'encoder'`, or `'viewer'`. Default is `'viewer'`.
*   **`is_active`** (Enum) - String enum with values `'active'` and `'inactive'`. Default is `'inactive'`. Admin toggles this to activate users.
*   **`created_at`** (Timestamp)

---

### 2. Core Master Data

These tables handle the configuration of assets that the Admin manages.

**Table: `vessels`**
*   **`id`** (UUID, PK) - Unique ID for the vessel.
*   **`name`** (String) - Name of the vessel.
*   **`created_at`** (Timestamp)

**Table: `equipments`**
Serves as the overarching category/grouping for specific items.
*   **`id`** (UUID, PK)
*   **`name`** (String) - E.g., "Navigation", "Engine".
*   **`created_at`** (Timestamp)

**Table: `items`**
Individual devices and tools linked to a specific equipment category.
*   **`id`** (UUID, PK)
*   **`equipment_id`** (UUID, FK) - References `equipments.id`. Parent is Equipment.
*   **`name`** (String)
*   **`is_spare`** (Enum) - String enum with values `'standard'` and `'spare'`. Used to separate "Equipment and Items" vs "Spare Items" under the HLCF tabs.
*   **`created_at`** (Timestamp)

---

### 3. Monthly Report Data

These tables maintain the data generated whenever an Encoder imports an Excel file.

**Table: `monthly_reports`**
Represents a single imported monthly report to group records logically.
*   **`id`** (UUID, PK)
*   **`vessel_id`** (UUID, FK) - References `vessels.id`. Identifies which vessel this report covers. 
*   **`report_month`** (Date) - The specific month this report represents (e.g., `2024-05-01`).
*   **`imported_by`** (UUID, FK) - References `profiles.id`. Identifies which encoder imported the file.
*   **`created_at`** (Timestamp)

**Table: `monthly_report_items`**
The actual breakdown of items imported from the Excel file (translated into DB rows).
*   **`id`** (UUID, PK)
*   **`report_id`** (UUID, FK) - References `monthly_reports.id`.
*   **`item_id`** (UUID, FK) - References `items.id`.
*   **`quantity`** (Integer) - Total count for the equipment as seen in the dashboard.
*   **`remarks`** (String/Text) - Optional notes.
*   **`created_at`** (Timestamp)

### Summary of Relationships:
1. **`equipments`** (1) ⸺ (Many) **`items`** 
2. **`vessels`** (1) ⸺ (Many) **`monthly_reports`**
3. **`profiles`** (1) ⸺ (Many) **`monthly_reports`** *(as imported_by)*
4. **`monthly_reports`** (1) ⸺ (Many) **`monthly_report_items`**
5. **`items`** (1) ⸺ (Many) **`monthly_report_items`**
