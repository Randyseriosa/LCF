---
trigger: always_on
---

Role:
Admin > Manage role of Encoder and Viewer
Encoder >  Have access to imports, can export summary.
Viewer > View only cant import, Can exports summary.

User login default role is viewer and inactive.
Admin can manage roles and activate the user.

Encoder and Viewer have the same features except Viewer role can only overview the dashboard and export summary.

Encoder can import excel files that contain the report for the month. Encoder can export and overview the dashboard.

System functionality.
Encoder imports the report for the month. Encoder and Viewer can overview and generate summary for the selected filters.

Admin can add Vessels name, Equipment and Items.

Equipments - serve as category of each items
Items - Each item, device and tools.

Encoder have sidebar that gave section tab for:
Dashboard - Show Total Count of all items per equipment
HLCF - Show two tabs, 1.) Equipment and Items 2.) Spare Items
Import - Import page of monthly report.
Vessels - Management page for vessels. Have unique id, 
Equipment - Management page for all items grouped by equipment.

Edge function to import excel file and export the details from the file to the system. Translate file to table to import to the system, and save to the system.

Create, Update Delete, Operation should be on Edge functions



