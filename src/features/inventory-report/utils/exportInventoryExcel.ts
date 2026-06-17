import * as XLSX from 'xlsx'
import type { BowGroupData, InventoryItem } from '@/hooks/useInventoryReport'
import {
    getCategoryFromEquipmentType,
    getEquipmentGroupLabel,
    type EquipmentCategory,
} from '@/features/equipment/utils/equipmentGroup'

function formatDate(date: string | null): string {
    if (!date) return ''
    try {
        const d = new Date(date)
        if (isNaN(d.getTime())) return date
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        return `${day}-${month}-${d.getFullYear()}`
    } catch {
        return date
    }
}

function sanitizeSheetName(name: string): string {
    // Excel sheet names cannot exceed 31 chars or contain: \ / * ? : [ ]
    return name.replace(/[\\/*?:\[\]]/g, '_').substring(0, 31)
}

interface CategoryGroup {
    name: string
    type: EquipmentCategory
    items: InventoryItem[]
}

function groupByCategory(items: InventoryItem[]): Record<EquipmentCategory, CategoryGroup> {
    return items.reduce((acc, item) => {
        const equipmentType = item.items?.equipments?.equipment_type || null
        const uniqueCode = item.items?.equipments?.unique_code || item.unique_code || null
        const category = getCategoryFromEquipmentType(equipmentType, uniqueCode)
        if (!acc[category]) {
            acc[category] = { name: getEquipmentGroupLabel(category), type: category, items: [] }
        }
        acc[category].items.push(item)
        return acc
    }, {} as Record<EquipmentCategory, CategoryGroup>)
}

const CATEGORY_ORDER: EquipmentCategory[] = [
    'WEAPONS',
    'COMMUNICATION',
    'NAVIGATIONAL',
    'ICT',
    'AMMUNITIONS',
]

/**
 * Build the column headers for a given equipment category.
 * Mirrors the columns displayed in BowGroup.tsx.
 */
function getHeaders(category: EquipmentCategory, hasReport: boolean): string[] {
    const isAmmunitions = category === 'AMMUNITIONS'
    const isNavigational = category === 'NAVIGATIONAL'

    if (isAmmunitions) {
        return [
            'Unique Code',
            'Classification',
            'Nomenclature',
            hasReport ? 'Balance on Hand' : 'Quantity',
        ]
    }

    const headers = [
        'Unique Code',
        'Classification',
        'Nomenclature',
        'Brand',
        'Model',
        'Serial Number',
        'Part Number',
        'Date Manufactured',
        'Date Installed',
        'ICS',
        'PAR',
    ]

    if (hasReport) {
        headers.push('Date of Last PMS')
        headers.push('Date of Last Repair')
    }

    if (hasReport && isNavigational) {
        headers.push('Running Hours')
    }

    if (hasReport) {
        headers.push('Status')
        headers.push('Remarks')
    }

    return headers
}

/**
 * Map an InventoryItem to an array of cell values matching `getHeaders`.
 */
function getRowValues(
    item: InventoryItem,
    category: EquipmentCategory,
    hasReport: boolean,
): (string | number)[] {
    const isAmmunitions = category === 'AMMUNITIONS'
    const isNavigational = category === 'NAVIGATIONAL'

    if (isAmmunitions) {
        return [
            item.unique_code || '',
            item.classification || '',
            item.nomenclature || '',
            hasReport ? (item.balance_on_hand ?? '') : (item.quantity ?? ''),
        ]
    }

    const row: (string | number)[] = [
        item.unique_code || '',
        item.classification || '',
        item.nomenclature || '',
        item.brand || '',
        item.model || '',
        item.serial_number || '',
        item.part_number || '',
        formatDate(item.date_manufactured),
        formatDate(item.date_installed_issued),
        item.ics || '',
        item.par || '',
    ]

    if (hasReport) {
        row.push(formatDate(item.date_last_pms))
        row.push(formatDate(item.date_last_repair))
    }

    if (hasReport && isNavigational) {
        row.push(item.running_hours ?? '')
    }

    if (hasReport) {
        row.push(item.status || '')
        row.push(item.remarks || '')
    }

    return row
}

/**
 * Exports the currently filtered bowGroups data to an Excel (.xlsx) file.
 * Each vessel is placed in a separate worksheet.
 * Items within each vessel are grouped by equipment category with sub-headers.
 */
export function exportInventoryToExcel(bowGroups: BowGroupData[]): void {
    if (bowGroups.length === 0) return

    const wb = XLSX.utils.book_new()

    // Track used sheet names to avoid duplicates
    const usedNames = new Set<string>()

    bowGroups.forEach((group) => {
        let sheetName = sanitizeSheetName(group.bowNumber || 'Unknown')

        // Ensure unique sheet name
        let baseName = sheetName
        let counter = 1
        while (usedNames.has(sheetName)) {
            sheetName = sanitizeSheetName(`${baseName}_${counter}`)
            counter++
        }
        usedNames.add(sheetName)

        const hasReport = group.hasReport
        const categorized = groupByCategory(group.items)

        // Build an array-of-arrays (AOA) for the entire sheet
        const sheetData: (string | number)[][] = []

        // Vessel header
        sheetData.push([`Vessel: ${group.bowNumber}`])
        sheetData.push([`Class: ${group.className}`])
        sheetData.push([`Report Status: ${hasReport ? (group.reportDate || 'Updated') : 'Masterlist Only'}`])
        sheetData.push([`Total Items: ${group.items.length}`])
        sheetData.push([]) // spacer row

        // Process each category in defined order
        const sortedCategories = CATEGORY_ORDER.filter((cat) => categorized[cat])

        sortedCategories.forEach((catKey, catIdx) => {
            const catGroup = categorized[catKey]
            if (!catGroup || catGroup.items.length === 0) return

            // Category sub-header
            sheetData.push([`${catGroup.name} (${catGroup.items.length} items)`])

            // Column headers
            const headers = getHeaders(catGroup.type, hasReport)
            sheetData.push(headers)

            // Data rows
            catGroup.items.forEach((item) => {
                sheetData.push(getRowValues(item, catGroup.type, hasReport))
            })

            // Spacer between categories
            if (catIdx < sortedCategories.length - 1) {
                sheetData.push([])
            }
        })

        const ws = XLSX.utils.aoa_to_sheet(sheetData)

        // ── Styling: set column widths ──
        // Determine the max number of columns from all rows
        const maxCols = Math.max(...sheetData.map((row) => row.length), 1)
        ws['!cols'] = Array.from({ length: maxCols }, () => ({ wch: 20 }))

        // Bold the vessel header rows (first 4 rows)
        // Note: xlsx community edition doesn't support full styling,
        // but column widths are respected.

        XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `Global_Inventory_Report_${dateStr}.xlsx`

    XLSX.writeFile(wb, filename)
}
