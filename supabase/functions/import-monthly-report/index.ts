/// <reference path="../deno.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { verifyToken } from '../_shared/jwt.ts'

interface MonthlyReportItem {
  unique_code: string
  classification: string
  nomenclature: string
  brand: string
  model: string
  serial_number: string
  part_number: string
  date_manufactured: string | number | null
  date_installed_issued: string | number | null
  ics: string
  par: string
  date_last_pms: string | number | null
  date_last_repair: string | number | null
  running_hours: string | null
  status: string
  remarks: string
  previous_report?: number | null
  expended?: number | null
  replenished?: number | null
  balance_on_hand?: number | null
}

interface ParsedFileInfo {
  bow_number: string
  month: number
  year: number
  month_name: string
}

interface Payload {
  file_data: string
  filename: string
}

/**
 * Parse filename to extract BOW number, month, and year
 * Format: "PC370-052026.xlsx" -> PC370, May, 2026
 */
function parseFilename(filename: string): ParsedFileInfo | null {
  const match = filename.match(/^([A-Z0-9]+)-(\d{2})(\d{4})\.(xlsx|xls)$/)
  if (!match) return null

  const [, bow_number, monthStr, yearStr] = match
  const month = parseInt(monthStr, 10)
  const year = parseInt(yearStr, 10)

  if (month < 1 || month > 12) return null

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return {
    bow_number,
    month,
    year,
    month_name: monthNames[month - 1]
  }
}

/**
 * Extract number from value (handles text strings like "123 hours")
 */
function extractNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value

  const str = String(value).trim()
  // Extract first number from string (e.g., "123 hours" -> 123)
  const match = str.match(/\d+/)
  if (match) {
    const num = parseInt(match[0], 10)
    return isNaN(num) ? null : num
  }

  return null
}

/**
 * Parse date from various formats and return a Date object
 */
function parseDate(dateInput: string | number | null | undefined): Date | null {
  if (!dateInput) return null

  if (typeof dateInput === 'string' && dateInput.trim() === '') return null

  let date: Date

  if (typeof dateInput === 'number') {
    if (dateInput < 1 || dateInput > 100000) return null
    const excelEpoch = new Date(1900, 0, 1)
    const daysToAdd = dateInput - 2
    date = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
  } else if (typeof dateInput === 'string') {
    const trimmedInput = dateInput.trim()
    const ddmmyyyyMatch = trimmedInput.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (ddmmyyyyMatch) {
      const [, dayStr, monthStr, yearStr] = ddmmyyyyMatch
      const day = parseInt(dayStr, 10)
      const month = parseInt(monthStr, 10)
      const year = parseInt(yearStr, 10)
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
      date = new Date(year, month - 1, day)
    } else {
      date = new Date(trimmedInput)
    }
  } else {
    return null
  }

  if (isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null

  const checkDate = new Date(year, month - 1, day)
  if (checkDate.getFullYear() !== year || checkDate.getMonth() + 1 !== month || checkDate.getDate() !== day) {
    return null
  }

  return date
}

/**
 * Format date to ISO format YYYY-MM-DD (for database storage)
 */
function formatDateToISO(dateInput: string | number | null | undefined): string | null {
  const date = parseDate(dateInput)
  if (!date) return null

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Build column map for a section based on headers
 */
function buildColumnMap(headers: string[]): Record<string, number> {
  const fieldMappings: Record<string, string[]> = {
    unique_code: ['unique code', 'unique_code', 'code'],
    classification: ['classification', 'class'],
    nomenclature: ['nomenclature', 'name'],
    brand: ['brand', 'manufacturer'],
    model: ['model'],
    serial_number: ['serial number', 'serial_number', 'serial'],
    part_number: ['part number', 'part_number', 'part'],
    date_manufactured: ['date manufactured', 'date_manufactured', 'manufactured date'],
    date_installed_issued: ['date installed', 'date issued', 'date_installed_issued', 'date installed/issued', 'installed date'],
    ics: ['ics', 'inventory custodian slip'],
    par: ['par', 'property acknowledgement receipt'],
    date_last_pms: ['date of last pms', 'date_last_pms', 'date last pms', 'last pms'],
    date_last_repair: ['date of last repair', 'date_last_repair', 'date last repair', 'last repair'],
    running_hours: ['running hours', 'running_hours', 'runninghours'],
    status: ['status'],
    remarks: ['remarks', 'comments'],
    previous_report: ['previous report', 'previous_report', 'previous'],
    expended: ['expended'],
    replenished: ['replenished'],
    balance_on_hand: ['balance on hand', 'balance_on_hand', 'balance']
  }

  const columnMap: Record<string, number> = {}

  for (const [field, possibleNames] of Object.entries(fieldMappings)) {
    for (const name of possibleNames) {
      const useExactOnly = ['ics', 'par'].includes(field)
      const index = headers.findIndex(h => h && (useExactOnly ? h === name : (h === name || h.includes(name))))
      if (index !== -1) {
        const headerValue = headers[index]
        if (index === 0 && (headerValue === 'nr' || headerValue === 'no' || headerValue === 'number' || headerValue === '#')) {
          continue
        }
        columnMap[field] = index
        break
      }
    }
  }

  return columnMap
}

/**
 * Parse a single data row into a MonthlyReportItem
 */
function parseDataRow(row: any[], columnMap: Record<string, number>): MonthlyReportItem | null {
  if (Object.keys(columnMap).length < 5) return null

  const unique_code = String(row[columnMap.unique_code] || '').trim()
  if (!unique_code) return null

  return {
    unique_code,
    classification: String(row[columnMap.classification] || '').trim(),
    nomenclature: String(row[columnMap.nomenclature] || '').trim(),
    brand: String(row[columnMap.brand] || '').trim(),
    model: String(row[columnMap.model] || '').trim(),
    serial_number: String(row[columnMap.serial_number] || '').trim(),
    part_number: String(row[columnMap.part_number] || '').trim(),
    date_manufactured: row[columnMap.date_manufactured] || null,
    date_installed_issued: row[columnMap.date_installed_issued] || null,
    ics: String(row[columnMap.ics] || '').trim(),
    par: String(row[columnMap.par] || '').trim(),
    date_last_pms: row[columnMap.date_last_pms] || null,
    date_last_repair: row[columnMap.date_last_repair] || null,
    running_hours: columnMap.running_hours && row[columnMap.running_hours] ? String(row[columnMap.running_hours]).trim() : null,
    status: String(row[columnMap.status] || '').trim(),
    remarks: String(row[columnMap.remarks] || '').trim(),
    previous_report: columnMap.previous_report ? extractNumber(row[columnMap.previous_report]) : null,
    expended: columnMap.expended ? extractNumber(row[columnMap.expended]) : null,
    replenished: columnMap.replenished ? extractNumber(row[columnMap.replenished]) : null,
    balance_on_hand: columnMap.balance_on_hand ? extractNumber(row[columnMap.balance_on_hand]) : null
  }
}

/**
 * Parse multi-section Excel file with equipment type sections
 */
function parseMultiSectionExcel(jsonData: any[][]): MonthlyReportItem[] {
  const items: MonthlyReportItem[] = []
  const sectionHeaders = ['weapons', 'communication equipment', 'navigational sensors', 'ict equipment', 'ammunitions', 'ammunition']

  let currentSection: string | null = null
  let currentColumnMap: Record<string, number> | null = null

  for (let currentRowIndex = 0; currentRowIndex < jsonData.length; currentRowIndex++) {
    const row = jsonData[currentRowIndex]
    if (!row || row.length === 0) continue

    const firstCell = String(row[0] || '').trim().toLowerCase()

    if (sectionHeaders.includes(firstCell)) {
      currentSection = firstCell
      currentRowIndex++

      if (currentRowIndex < jsonData.length) {
        const headerRow = jsonData[currentRowIndex]
        if (headerRow && headerRow.length > 0) {
          const headers = headerRow.map((h: any) => String(h).trim().toLowerCase())
          currentColumnMap = buildColumnMap(headers)
        }
      }
      continue
    }

    if (currentColumnMap) {
      const item = parseDataRow(row, currentColumnMap)
      if (item) {
        items.push(item)
      }
    }
  }

  return items
}

interface Payload {
  file_data: string
  filename: string
}

/**
 * Authenticate user and verify role
 */
async function authenticateUser(authHeader: string | null) {
  if (!authHeader) {
    return { error: 'Missing authorization header', status: 401 }
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Invalid authorization format. Expected "Bearer <token>"', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyToken(token)

  if (!payload) {
    return { error: 'Invalid or expired token', status: 401 }
  }

  if (!['admin', 'encoder'].includes(payload.role) || payload.is_active !== 'active') {
    return { error: `Forbidden: Active admin or encoder role required. Current role: ${payload.role}, Status: ${payload.is_active}`, status: 403 }
  }

  return { user_id: payload.user_id, role: payload.role }
}

/**
 * Decode base64 file data to Uint8Array
 */
function decodeBase64File(fileData: string): Uint8Array {
  const base64Data = fileData.split(',')[1]
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Parse Excel file from bytes
 */
function parseExcelFile(bytes: Uint8Array): any[][] {
  const workbook = XLSX.read(bytes, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
}

/**
 * Sort equipment codes by length (longest first) - non-recursive approach
 */
function sortEquipmentCodesByLength(codes: string[]): string[] {
  // Use a bucket sort approach to avoid stack overflow with large arrays
  const maxLength = Math.max(...codes.map(c => c.length))
  const buckets: string[][] = Array.from({ length: maxLength + 1 }, () => [])

  for (const code of codes) {
    buckets[code.length].push(code)
  }

  const result: string[] = []
  for (let i = maxLength; i >= 0; i--) {
    result.push(...buckets[i])
  }

  return result
}

/**
 * Filter items by equipment code using batch processing
 */
function filterItemsByEquipment(
  items: MonthlyReportItem[],
  equipmentMap: Record<string, string>,
  batchSize: number = 100
): MonthlyReportItem[] {
  const sortedEquipmentCodes = sortEquipmentCodesByLength(Object.keys(equipmentMap))
  const validItems: MonthlyReportItem[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)

    for (const item of batch) {
      let matchedEquipmentCode: string | null = null

      for (const equipCode of sortedEquipmentCodes) {
        if (item.unique_code.startsWith(equipCode)) {
          matchedEquipmentCode = equipCode
          break
        }
      }

      if (!matchedEquipmentCode) {
        const parts = item.unique_code.split('-')
        if (parts.length >= 1) {
          const prefix = parts[0]
          // Try exact match first (e.g. AM01 -> AM01)
          if (prefix in equipmentMap) {
            matchedEquipmentCode = prefix
          } else {
            // Try 2-letter prefix match (e.g. AM01 -> AM)
            const shortPrefix = prefix.substring(0, 2)
            if (shortPrefix in equipmentMap) {
              matchedEquipmentCode = shortPrefix
            } else {
              matchedEquipmentCode = prefix
            }
          }
        }
      }

      if (matchedEquipmentCode !== null && matchedEquipmentCode in equipmentMap) {
        validItems.push(item)
      }
    }

  }

  return validItems
}

/**
 * Create a new monthly report record
 */
async function createReport(
  supabaseAdmin: any,
  vesselId: string,
  reportMonth: string,
  userId: string
): Promise<{ reportId: string; error?: string }> {
  const { data: newReport, error: createReportError } = await supabaseAdmin
    .from('monthly_reports')
    .insert({
      vessel_id: vesselId,
      report_month: reportMonth,
      imported_by: userId
    })
    .select('id')
    .single()

  if (createReportError || !newReport) {
    return { reportId: '', error: 'Failed to create monthly report record' }
  }

  return { reportId: newReport.id }
}

/**
 * Get previous month's report for ammunition validation
 */
async function getPreviousMonthReport(
  supabaseAdmin: any,
  vesselId: string,
  currentReportMonth: string
): Promise<{ reportId: string | null; ammunitionItems: any[]; error?: string }> {
  const currentDate = new Date(currentReportMonth)
  const previousMonthDate = new Date(currentDate)
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)

  const previousMonthStr = previousMonthDate.toISOString().slice(0, 7) + '-01'

  const { data: previousReport, error: reportError } = await supabaseAdmin
    .from('monthly_reports')
    .select('id')
    .eq('vessel_id', vesselId)
    .eq('report_month', previousMonthStr)
    .single()

  if (reportError || !previousReport) {
    return { reportId: null, ammunitionItems: [] }
  }

  // Fetch ammunition items from previous report
  const { data: reportItems, error: itemsError } = await supabaseAdmin
    .from('monthly_report_items')
    .select(`
      unique_code,
      balance_on_hand,
      items!inner (
        equipments!inner (
          equipment_type
        )
      )
    `)
    .eq('report_id', previousReport.id)

  if (itemsError) {
    return { reportId: null, ammunitionItems: [], error: itemsError.message }
  }

  // Filter only ammunition items
  const ammunitionItems = reportItems?.filter((item: any) =>
    item.items?.equipments?.equipment_type === 'ammunitions'
  ) || []

  return { reportId: previousReport.id, ammunitionItems }
}

/**
 * Validate ammunition data against previous report
 */
async function validateAmmunitionData(
  supabaseAdmin: any,
  vesselId: string,
  currentReportMonth: string,
  ammunitionItems: MonthlyReportItem[]
): Promise<{ valid: boolean; error?: string }> {
  const { reportId: previousReportId, ammunitionItems: previousAmmoItems } =
    await getPreviousMonthReport(supabaseAdmin, vesselId, currentReportMonth)

  // Create a map of previous ammunition items by unique_code
  const previousAmmoMap = new Map(
    previousAmmoItems.map((item: any) => [item.unique_code, item.balance_on_hand])
  )

  // If no previous report exists, validate against masterlist
  if (!previousReportId && previousAmmoItems.length === 0) {
    const uniqueCodes = ammunitionItems.map(item => item.unique_code)
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('unique_code, quantity')
      .in('unique_code', uniqueCodes)

    if (itemsError) {
      return { valid: false, error: 'Failed to fetch masterlist for validation' }
    }

    const masterlistMap = new Map(
      items?.map((item: any) => [item.unique_code, item.quantity]) || []
    )

    for (const ammoItem of ammunitionItems) {
      // If previous_report is null/missing in the import, skip validation for that item
      if (ammoItem.previous_report === null || ammoItem.previous_report === undefined) continue

      const masterlistQuantity = masterlistMap.get(ammoItem.unique_code)
      if (masterlistQuantity !== null && masterlistQuantity !== undefined) {
        if (ammoItem.previous_report !== masterlistQuantity) {
          return {
            valid: false,
            error: `Previous Report is not matched with the Masterlist Quantity for item ${ammoItem.unique_code}. Expected: ${masterlistQuantity}, Got: ${ammoItem.previous_report}`
          }
        }
      }
    }
  } else {
    // Validate against previous report
    for (const ammoItem of ammunitionItems) {
      // If previous_report is null/missing in the import, skip validation for that item
      if (ammoItem.previous_report === null || ammoItem.previous_report === undefined) continue

      const previousBalance = previousAmmoMap.get(ammoItem.unique_code)
      if (previousBalance !== null && previousBalance !== undefined) {
        if (ammoItem.previous_report !== previousBalance) {
          return {
            valid: false,
            error: `Previous Report is not matched with the Last Balance on Hand for item ${ammoItem.unique_code}. Expected: ${previousBalance}, Got: ${ammoItem.previous_report}`
          }
        }
      }
    }
  }

  // Validate balance calculation
  for (const ammoItem of ammunitionItems) {
    const prev = ammoItem.previous_report ?? null
    const exp = ammoItem.expended ?? null
    const rep = ammoItem.replenished ?? null
    const bal = ammoItem.balance_on_hand ?? null

    if (prev !== null && exp !== null && rep !== null && bal !== null) {
      const calculatedBalance = prev - exp + rep
      if (calculatedBalance !== bal) {
        return {
          valid: false,
          error: `Balance calculation mismatch for item ${ammoItem.unique_code}. Expected: ${calculatedBalance}, Got: ${bal}`
        }
      }
    }
  }

  return { valid: true }
}

/**
 * Insert report items in batches
 */
async function insertReportItemsBatches(
  supabaseAdmin: any,
  reportItems: any[],
  batchSize: number = 100
): Promise<{ error?: string }> {
  for (let i = 0; i < reportItems.length; i += batchSize) {
    const batch = reportItems.slice(i, i + batchSize)
    const { error: insertError } = await supabaseAdmin
      .from('monthly_report_items')
      .insert(batch)

    if (insertError) {
      return { error: insertError.message }
    }

  }

  return {}
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const authResult = await authenticateUser(authHeader)

    if (authResult.error) {
      return errorResponse(authResult.error, authResult.status)
    }

    const body: Payload = await req.json()
    const { file_data, filename } = body

    if (!file_data || !filename) {
      return errorResponse('file_data and filename are required', 400)
    }

    const fileInfo = parseFilename(filename)
    if (!fileInfo) {
      return errorResponse('Invalid filename format. Expected format: PC370-052026.xlsx', 400)
    }

    // Check if report month is in the future
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // getMonth() is 0-indexed

    if (fileInfo.year > currentYear || (fileInfo.year === currentYear && fileInfo.month > currentMonth)) {
      return errorResponse(`Cannot import report in advance. Selected month (${fileInfo.month_name} ${fileInfo.year}) is in the future.`, 400)
    }

    const bytes = decodeBase64File(file_data)

    const jsonData = parseExcelFile(bytes)

    if (jsonData.length < 2) {
      return errorResponse('The file appears to be empty or has no data rows', 400)
    }

    const items = parseMultiSectionExcel(jsonData)

    if (items.length === 0) {
      return errorResponse('No valid data rows found in the file', 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: equipments, error: equipmentsError } = await supabaseAdmin
      .from('equipments')
      .select('id, unique_code')

    if (equipmentsError || !equipments) {
      return errorResponse('Failed to fetch equipments', 500)
    }

    // Resolve the internal profile ID from the auth_user_id (from JWT)
    // The imported_by column in monthly_reports references profiles.id, 
    // while the JWT user_id corresponds to auth_users.id.
    const { data: importerProfile, error: importerError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authResult.user_id)
      .single()

    if (importerError || !importerProfile) {
      console.error('[import-monthly-report] Profile lookup failed:', importerError)
      return errorResponse('Importer profile not found', 404)
    }

    const importerId = importerProfile.id

    const equipmentMap: Record<string, string> = {}
    equipments.forEach((equip: { id: string; unique_code: string | null }) => {
      if (equip.unique_code && equip.id) {
        equipmentMap[equip.unique_code] = equip.id
      }
    })

    const validItems = filterItemsByEquipment(items, equipmentMap)

    if (validItems.length === 0) {
      return errorResponse('No items matched any equipment codes. Please ensure the items have valid equipment prefixes.', 400)
    }

    const { data: vessel, error: vesselError } = await supabaseAdmin
      .from('vessels')
      .select('id')
      .eq('bow_number', fileInfo.bow_number)
      .single()

    if (vesselError || !vessel) {
      return errorResponse(`Vessel with BOW number "${fileInfo.bow_number}" not found`, 404)
    }

    // Validate items against vessel masterlist (vessel_item_assignments)
    const { data: vesselAssignments, error: assignmentError } = await supabaseAdmin
      .from('vessel_item_assignments')
      .select(`
        item_id,
        items!vessel_item_assignments_item_id_fkey (
          id,
          unique_code
        )
      `)
      .eq('vessel_id', vessel.id)
      .eq('is_current', true)

    if (assignmentError) {
      return errorResponse('Failed to fetch vessel masterlist', 500)
    }

    // Create a set of unique_codes from the vessel's masterlist
    const masterlistUniqueCodes = new Set(
      vesselAssignments?.map((a: any) => a.items?.unique_code).filter(Boolean) || []
    )

    // Check if all items in the import are in the vessel's masterlist
    const itemsNotInMasterlist: string[] = []
    validItems.forEach(item => {
      if (!masterlistUniqueCodes.has(item.unique_code)) {
        itemsNotInMasterlist.push(item.unique_code)
      }
    })

    if (itemsNotInMasterlist.length > 0) {
      return errorResponse(
        `Import blocked. The following items are not in the vessel's masterlist: ${itemsNotInMasterlist.slice(0, 10).join(', ')}${itemsNotInMasterlist.length > 10 ? '...' : ''}`,
        400
      )
    }

    const reportMonth = `${fileInfo.year}-${String(fileInfo.month).padStart(2, '0')}-01`

    // Fetch equipment types to identify ammunition items
    const uniqueCodes = validItems.map(item => item.unique_code)
    const { data: itemsWithEquipment } = await supabaseAdmin
      .from('items')
      .select('unique_code, equipments!inner (equipment_type)')
      .in('unique_code', uniqueCodes)

    const equipmentTypeMap = new Map(
      itemsWithEquipment?.map((item: any) => [item.unique_code, item.equipments.equipment_type]) || []
    )

    // Filter ammunition items for validation
    const ammunitionItems = validItems.filter(item =>
      equipmentTypeMap.get(item.unique_code) === 'ammunitions'
    )

    // Validate ammunition data if present
    if (ammunitionItems.length > 0) {
      const validationResult = await validateAmmunitionData(
        supabaseAdmin,
        vessel.id,
        reportMonth,
        ammunitionItems
      )

      if (!validationResult.valid) {
        return errorResponse(validationResult.error || 'Ammunition validation failed', 400)
      }
    }
    const reportResult = await createReport(supabaseAdmin, vessel.id, reportMonth, importerId)
    if (reportResult.error) return errorResponse(reportResult.error, 500)
    const reportId = reportResult.reportId

    const { data: existingItems, error: existingItemsError } = await supabaseAdmin
      .from('items')
      .select('id, unique_code')
      .in('unique_code', uniqueCodes)


    const itemMap = new Map(existingItems?.map((item: { id: string; unique_code: string }) => [item.unique_code, item.id]) || [])

    const reportItems = validItems.map(item => {
      const itemId = itemMap.get(item.unique_code)
      const isAmmunition = equipmentTypeMap.get(item.unique_code) === 'ammunitions'

      const baseItem = {
        report_id: reportId,
        item_id: itemId || null,
        unique_code: item.unique_code,
        classification: item.classification,
        nomenclature: item.nomenclature,
        brand: item.brand,
        model: item.model,
        serial_number: item.serial_number,
        part_number: item.part_number,
        date_manufactured: formatDateToISO(item.date_manufactured),
        date_installed_issued: formatDateToISO(item.date_installed_issued),
        ics: item.ics || null,
        par: item.par || null,
        date_last_pms: formatDateToISO(item.date_last_pms),
        date_last_repair: formatDateToISO(item.date_last_repair),
        running_hours: item.running_hours,
        status: item.status || null,
        remarks: item.remarks || null
      }

      // Add ammunition-specific fields only for ammunition items
      if (isAmmunition) {
        return {
          ...baseItem,
          previous_report: item.previous_report ?? null,
          expended: item.expended ?? null,
          replenished: item.replenished ?? null,
          balance_on_hand: item.balance_on_hand ?? null
        }
      }

      return baseItem
    })

    const insertResult = await insertReportItemsBatches(supabaseAdmin, reportItems, 100)

    if (insertResult.error) {
      return errorResponse(insertResult.error, 500)
    }

    // Perform sync check after successful import
    const syncCheckPayload = { report_id: reportId }
    const syncCheckResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-check-monthly-report`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncCheckPayload)
      }
    )

    let syncCheckResult = null
    if (syncCheckResponse.ok) {
      const syncData = await syncCheckResponse.json()
      syncCheckResult = syncData.data
    }

    return successResponse({
      message: `Successfully imported ${reportItems.length} items for ${fileInfo.month_name} ${fileInfo.year}`,
      count: reportItems.length,
      vessel: fileInfo.bow_number,
      month: fileInfo.month_name,
      year: fileInfo.year,
      report_id: reportId,
      sync_check: syncCheckResult
    })
  } catch (err) {
    return errorResponse('Internal server error: ' + (err as Error).message, 500)
  }
})

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function successResponse(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
