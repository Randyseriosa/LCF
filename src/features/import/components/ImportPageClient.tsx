'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Upload, FileSpreadsheet, FileText, Check, AlertCircle, Calendar, Inbox, Eye, CheckCircle, XCircle, Clock } from 'lucide-react'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { useMonthlyReportStatus } from '@/hooks/useMonthlyReportStatus'
import { useRecentImports } from '@/hooks/useRecentImports'
import { useRecentDerangementImports } from '@/hooks/useRecentDerangementImports'

interface ImportRecord {
  month: string
  year: string
  vessel_name: string
  equipment_name: string
  item_count: number
  file_name: string
}

interface MonthlyReportItem {
  unique_code: string
  classification: string
  nomenclature: string
  brand: string
  model: string
  serial_number: string
  part_number: string
  date_manufactured: string | null
  date_installed_issued: string | null
  ics: string
  par: string
  date_last_pms: string | null
  date_last_repair: string | null
  running_hours: string | null
  quantity: number | null
  status: string
  remarks: string
  // Ammunition-specific fields
  previous_report?: number | null
  expended?: number | null
  replenished?: number | null
  balance_on_hand?: number | null
  section?: string // Track which section the item came from
  syncStatus?: 'sync' | 'not_on_masterlist' | 'mismatched' | 'internal_duplicate'
  mismatchedFields?: string[]
}

const formatPreviewDate = (dateVal: any) => {
  if (!dateVal) return '-'
  if (dateVal instanceof Date) {
    const day = String(dateVal.getDate()).padStart(2, '0')
    const month = String(dateVal.getMonth() + 1).padStart(2, '0')
    const year = dateVal.getFullYear()
    return `${day}-${month}-${year}`
  }
  if (typeof dateVal === 'string') {
    if (dateVal.includes('-')) {
      const parts = dateVal.split('T')[0].split('-')
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`
        }
        return dateVal
      }
    }
  }
  return String(dateVal)
}

interface Equipment {
  id: string
  unique_code: string
  name: string
  equipment_type?: string | null
}

interface ParsedFileInfo {
  bow_number: string
  month: number
  year: number
  month_name: string
}

interface SyncCheckResult {
  sync: MonthlyReportItem[]
  notOnMasterlist: MonthlyReportItem[]
  mismatched: MonthlyReportItem[]
  internalDuplicates: MonthlyReportItem[]
  missedItems: MissedItem[]
  vesselId: string | null
}

interface MissedItem {
  unique_code: string
  classification: string
  nomenclature: string
  equipment_name: string
  equipment_code: string
}

const textMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()
  return normalize(a) === normalize(b)
}

const parseDateToISO = (val: string | null | undefined): string | null => {
  if (!val || !String(val).trim()) return null
  const str = String(val).trim()
  // Excel serial number
  const num = Number(str)
  if (!isNaN(num) && num > 1 && num < 100000) {
    const epoch = new Date(1900, 0, 1)
    const d = new Date(epoch.getTime() + (num - 2) * 86400000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  return null
}

const dateMatch = (excelDate: string | null | undefined, isoDate: string | null | undefined): boolean => {
  if (!excelDate && !isoDate) return true
  if (!excelDate || !isoDate) return false
  const parsedExcel = parseDateToISO(excelDate)
  const parsedIso = isoDate.slice(0, 10)
  if (!parsedExcel) return false
  return parsedExcel === parsedIso
}

const formatDateForDisplay = (dateString: string | null): string => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    return `${day}-${month}-${year}`
  } catch {
    return dateString
  }
}

const formatReportMonth = (dateString: string): string => {
  try {
    const [year, month] = dateString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`
  } catch {
    return dateString
  }
}

const extractNumber = (value: any): number | null => {
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

export function ImportPageClient({ mode = 'monthly' }: { mode?: 'monthly' | 'derangement' }) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<MonthlyReportItem[]>([])
  const [fileInfo, setFileInfo] = useState<ParsedFileInfo | null>(null)
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({})
  const [syncCheckResults, setSyncCheckResults] = useState<SyncCheckResult | null>(null)
  const [isCheckingSync, setIsCheckingSync] = useState(false)
  const [vesselId, setVesselId] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{ title: string; message: string }>({ title: '', message: '' })
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renderCount = useRef(0)

  const { imports: recentMonthlyImports, loading: loadingMonthly, refresh: refreshRecentMonthly } = useRecentImports(10)
  const { imports: recentDerangementImports, loading: loadingDerangement, refresh: refreshRecentDerangement } = useRecentDerangementImports(10)

  const recentImports = mode === 'monthly' ? recentMonthlyImports : recentDerangementImports
  const refreshRecentImports = mode === 'monthly' ? refreshRecentMonthly : refreshRecentDerangement
  const loadingRecent = mode === 'monthly' ? loadingMonthly : loadingDerangement

  // Filter recent imports based on business rules:
  // 1. Max 10 list total.
  // 2. Only List 10 when the imported date is within 7 days (list only those within a week).
  // 3. If the most recent imported files are on 8th day or older, show only the most recent 5.
  const displayedImports = useMemo(() => {
    if (!recentImports || recentImports.length === 0) return []

    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Since recentImports is ordered desc by created_at, first item is the most recent
    const latestImportDate = new Date(recentImports[0].created_at)

    if (latestImportDate >= oneWeekAgo) {
      // Rule: List up to 10 that are within the week
      return recentImports
        .filter(item => new Date(item.created_at) >= oneWeekAgo)
        .slice(0, 10)
    } else {
      // Rule: If most recent is on 8th day or older, show only the most recent 5
      return recentImports.slice(0, 5)
    }
  }, [recentImports])

  // Helper to wrap actions with a tactical loading screen
  const withLoading = async (message: string, action: () => Promise<void> | void) => {
    setIsGlobalLoading(true)
    setLoadingMessage(message)
    try {
      await action()
    } finally {
      setIsGlobalLoading(false)
      setLoadingMessage('')
    }
  }

  // Check if monthly report already exists for this vessel/month
  const { status: reportStatus, loading: checkingReportStatus } = useMonthlyReportStatus({
    vesselId,
    month: fileInfo?.month,
    year: fileInfo?.year
  })

  // Track component renders
  renderCount.current++
  console.log('[DEBUG] Component render count:', renderCount.current)

  // Compute sorted equipment codes from equipments state
  const sortedEquipmentCodes = useMemo(() => {
    return Object.keys(equipments).sort((a, b) => b.length - a.length)
  }, [equipments])

  const isAmmunitionItem = useCallback((item: MonthlyReportItem) => {
    if (item.section === 'ammunitions' || item.section === 'ammunition') return true

    // Check if unique code matches any equipment prefixed that is ammunition
    let matchedEquipmentCode: string | null = null
    for (const equipCode of sortedEquipmentCodes) {
      if (item.unique_code.startsWith(equipCode)) {
        matchedEquipmentCode = equipCode
        break
      }
    }
    if (matchedEquipmentCode) {
      const equip = equipments[matchedEquipmentCode]
      return equip?.equipment_type === 'ammunitions' || equip?.equipment_type === 'ammunition'
    }
    return false
  }, [equipments, sortedEquipmentCodes])

  const { mismatchedStandard, mismatchedAmmunition } = useMemo(() => {
    if (!syncCheckResults?.mismatched) {
      return { mismatchedStandard: [], mismatchedAmmunition: [] }
    }
    const standard: MonthlyReportItem[] = []
    const ammo: MonthlyReportItem[] = []
    syncCheckResults.mismatched.forEach(item => {
      if (isAmmunitionItem(item)) {
        ammo.push(item)
      } else {
        standard.push(item)
      }
    })
    return { mismatchedStandard: standard, mismatchedAmmunition: ammo }
  }, [syncCheckResults?.mismatched, isAmmunitionItem])

  const prefixBase = fileInfo?.bow_number || ''
  const mismatchedFilenameItems = useMemo(() => {
    if (mode !== 'monthly' || !previewData || previewData.length === 0 || !prefixBase) return []
    return previewData.filter(item =>
      item.unique_code &&
      !item.unique_code.toLowerCase().includes(prefixBase.toLowerCase())
    )
  }, [previewData, prefixBase, mode])

  const hasMismatchedUniqueCode = mismatchedFilenameItems.length > 0

  // Fetch equipment data on component mount
  useEffect(() => {
    fetchEquipments()
  }, [])

  // Memoize grouped items to prevent infinite re-renders
  const groupedItems = useMemo(() => {
    if (!showPreview || previewData.length === 0) {
      return {}
    }

    console.log('[DEBUG] Memoizing grouped items. Preview data length:', previewData.length)

    const groups: Record<string, MonthlyReportItem[]> = {}

    previewData.forEach((item, index) => {
      if (index % 10 === 0) {
        console.log(`[DEBUG] Grouping item ${index}/${previewData.length}: ${item.unique_code}`)
      }


      let matchedEquipmentCode: string | null = null

      // Use pre-sorted equipment codes to avoid sorting on every iteration
      for (const equipCode of sortedEquipmentCodes) {
        if (item.unique_code.startsWith(equipCode)) {
          matchedEquipmentCode = equipCode
          break
        }
      }

      // If no match found, try determining from prefix
      if (!matchedEquipmentCode) {
        const parts = item.unique_code.split('-')
        if (parts.length >= 1) {
          const prefix = parts[0]
          // See if there's any equipment code exactly matching this prefix
          matchedEquipmentCode = sortedEquipmentCodes.find(c => c === prefix) || null
        }
      }

      // Only add items that match an equipment code
      if (matchedEquipmentCode) {
        if (!groups[matchedEquipmentCode]) {
          groups[matchedEquipmentCode] = []
        }
        groups[matchedEquipmentCode].push(item)
      } else {
        const fallbackGroup = (item.section === 'ammunitions' || item.section === 'ammunition')
          ? 'Uncategorized Ammunitions'
          : 'Uncategorized'
        if (!groups[fallbackGroup]) groups[fallbackGroup] = []
        groups[fallbackGroup].push(item)
      }
    })

    console.log('[DEBUG] Grouping complete. Grouped items count:', Object.keys(groups).length)
    return groups
  }, [previewData, sortedEquipmentCodes, showPreview])

  // Memoize sorted equipment codes for rendering
  const sortedGroupedEquipmentCodes = useMemo(() => {
    const codes = Object.keys(groupedItems).sort()
    console.log('[DEBUG] Memoizing sorted equipment codes:', codes)
    return codes
  }, [groupedItems])

  const fetchEquipments = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('equipments')
        .select('id, unique_code, name, equipment_type')

      if (error) throw error

      // Create a map of unique_code -> { id, name, equipment_type }
      const equipmentMap: Record<string, Equipment> = {}
      data?.forEach(equip => {
        if (equip.unique_code && equip.id) {
          equipmentMap[equip.unique_code] = {
            id: equip.id,
            unique_code: equip.unique_code,
            name: equip.name,
            equipment_type: equip.equipment_type
          }
        }
      })

      setEquipments(equipmentMap)
    } catch (err) {
      console.error('Error fetching equipments:', err)
    }
  }

  const performSyncCheck = async (items: MonthlyReportItem[], bowNumber: string, currentMonth?: number, currentYear?: number) => {
    setIsCheckingSync(true)
    try {
      const supabase = createClient()

      const { data: vessel, error: vesselError } = await supabase
        .from('vessels')
        .select('id')
        .eq('bow_number', bowNumber)
        .single()

      if (vesselError || !vessel) {
        setVesselId(null)
        setSyncCheckResults({ sync: [], notOnMasterlist: items, mismatched: [], internalDuplicates: [], missedItems: [], vesselId: null })
        setError(`Vessel '${bowNumber}' not found. Please ask Admin to register this vessel first.`)
        return
      }

      setVesselId(vessel.id)

      // Fetch vessel's current masterlist via vessel_item_assignments with all static columns
      const { data: assignments, error: masterlistError } = await supabase
        .from('vessel_item_assignments')
        .select(`
          items!vessel_item_assignments_item_id_fkey (
            id,
            unique_code,
            classification,
            nomenclature,
            brand,
            model,
            serial_number,
            part_number,
            date_manufactured,
            date_installed_issued,
            quantity,
            equipments!inner (id, unique_code, name, equipment_type)
          )
        `)
        .eq('vessel_id', vessel.id)
        .eq('is_current', true)

      if (masterlistError) throw masterlistError

      // Build masterlist map by unique_code with full static columns
      type MasterEntry = {
        id: string; unique_code: string; classification: string | null; nomenclature: string | null
        brand: string | null; model: string | null; serial_number: string | null; part_number: string | null
        date_manufactured: string | null; date_installed_issued: string | null
        quantity: number | null
        equipment_name: string; equipment_code: string; equipment_type: string | null
      }
      const masterlistMap = new Map<string, MasterEntry>()
        ; (assignments || []).forEach((a: any) => {
          const it = a.items
          if (it?.unique_code) {
            masterlistMap.set(it.unique_code, {
              id: it.id, unique_code: it.unique_code,
              classification: it.classification, nomenclature: it.nomenclature,
              brand: it.brand, model: it.model, serial_number: it.serial_number, part_number: it.part_number,
              date_manufactured: it.date_manufactured, date_installed_issued: it.date_installed_issued,
              quantity: it.quantity,
              equipment_name: it.equipments?.name || 'Unknown',
              equipment_code: it.equipments?.unique_code || 'Unknown',
              equipment_type: it.equipments?.equipment_type || null
            })
          }
        })

      // Check for internal duplicates in the file
      const counts = new Map<string, number>()
      items.forEach(item => {
        if (item.unique_code) {
          counts.set(item.unique_code, (counts.get(item.unique_code) || 0) + 1)
        }
      })

      const repeatedCodes = Array.from(counts.entries())
        .filter(([_, count]) => count > 1)
        .map(([code, _]) => code)

      if (repeatedCodes.length > 0) {
        setError(`Duplicate Unique Code: The following codes appear multiple times in the file: ${repeatedCodes.join(', ')}`)
      }

      const reportUniqueCodes = new Set(items.map(i => i.unique_code))
      const sync: MonthlyReportItem[] = []
      const notOnMasterlist: MonthlyReportItem[] = []
      const mismatched: MonthlyReportItem[] = []
      const internalDuplicates: MonthlyReportItem[] = []

      let previousReportItemsMap: Map<string, number> | null = null

      if (currentMonth && currentYear) {
        let prevMonth = currentMonth - 1
        let prevYear = currentYear
        if (prevMonth === 0) {
          prevMonth = 12
          prevYear -= 1
        }
        const prevDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`

        const { data: previousReport } = await supabase
          .from('monthly_reports')
          .select('id')
          .eq('vessel_id', vessel.id)
          .eq('report_month', prevDate)
          .single()

        if (previousReport) {
          const { data: prevItems } = await supabase
            .from('monthly_report_items')
            .select('unique_code, balance_on_hand')
            .eq('report_id', previousReport.id)

          if (prevItems && prevItems.length > 0) {
            previousReportItemsMap = new Map<string, number>()
            prevItems.forEach(pi => {
              if (pi.unique_code && pi.balance_on_hand != null) {
                previousReportItemsMap!.set(pi.unique_code, pi.balance_on_hand)
              }
            })
          }
        }
      }

      items.forEach(item => {
        const master = masterlistMap.get(item.unique_code)
        const isInternalDuplicate = counts.get(item.unique_code)! > 1

        if (isInternalDuplicate) {
          internalDuplicates.push({ ...item, syncStatus: 'internal_duplicate' })
          return
        }

        if (!master) {
          notOnMasterlist.push({ ...item, syncStatus: 'not_on_masterlist' })
          return
        }

        const isAmmunition = master.equipment_type === 'ammunitions' || master.equipment_type === 'ammunition' || (item.section === 'ammunitions' || item.section === 'ammunition')
        let allMatched = true
        const mismatchedFields: string[] = []

        if (!textMatch(item.classification, master.classification)) { allMatched = false; mismatchedFields.push('classification') }
        if (!textMatch(item.nomenclature, master.nomenclature)) { allMatched = false; mismatchedFields.push('nomenclature') }

        if (!isAmmunition) {
          if (!textMatch(item.brand, master.brand)) { allMatched = false; mismatchedFields.push('brand') }
          if (!textMatch(item.model, master.model)) { allMatched = false; mismatchedFields.push('model') }
          if (!textMatch(item.serial_number, master.serial_number)) { allMatched = false; mismatchedFields.push('serial_number') }
          if (!textMatch(item.part_number, master.part_number)) { allMatched = false; mismatchedFields.push('part_number') }
          if (!dateMatch(item.date_manufactured, master.date_manufactured)) { allMatched = false; mismatchedFields.push('date_manufactured') }
          if (!dateMatch(item.date_installed_issued, master.date_installed_issued)) { allMatched = false; mismatchedFields.push('date_installed_issued') }
        } else {
          // Ammunitions check logic
          if (item.previous_report !== undefined && item.previous_report !== null) {
            // Checked below against previous month or masterlist
            if (previousReportItemsMap) {
              const prevBOH = previousReportItemsMap.get(item.unique_code)
              if (prevBOH !== undefined && prevBOH !== item.previous_report) {
                allMatched = false
                mismatchedFields.push('previous_report')
              } else if (prevBOH === undefined) {
                // Not in previous report, fallback to masterlist quantity
                if (master.quantity !== item.previous_report) { allMatched = false; mismatchedFields.push('previous_report') }
              }
            } else {
              // First time import (no previous report found)
              if (master.quantity !== item.previous_report) { allMatched = false; mismatchedFields.push('previous_report') }
            }
          }
        }

        if (allMatched) {
          sync.push({ ...item, syncStatus: 'sync' })
        } else {
          mismatched.push({ ...item, syncStatus: 'mismatched', mismatchedFields })
        }
      })

      // Find missed items: masterlist items not present in report
      const missedItems: MissedItem[] = []
      masterlistMap.forEach((master, uniqueCode) => {
        if (!reportUniqueCodes.has(uniqueCode)) {
          missedItems.push({
            unique_code: uniqueCode,
            classification: master.classification || '',
            nomenclature: master.nomenclature || '',
            equipment_name: master.equipment_name,
            equipment_code: master.equipment_code
          })
        }
      })

      setSyncCheckResults({ sync, notOnMasterlist, mismatched, internalDuplicates, missedItems, vesselId: vessel.id })
      setPreviewData([...sync, ...mismatched, ...notOnMasterlist, ...internalDuplicates])
    } catch (err: any) {
      setError('Failed to perform sync check: ' + (err?.message || 'Unknown error'))
    } finally {
      setIsCheckingSync(false)
    }
  }

  const parseMultiSectionExcel = (jsonData: any[][]): MonthlyReportItem[] => {
    const fieldMappings: Record<string, string[]> = {
      unique_code: ['unique code', 'unique_code', 'code', 'uniquecode'],
      classification: ['classification', 'class'],
      nomenclature: ['nomenclature', 'name', 'item name', 'description'],
      brand: ['brand', 'manufacturer'],
      model: ['model'],
      serial_number: ['serial number', 'serial_number', 'serial', 'serialno'],
      part_number: ['part number', 'part_number', 'part', 'partno'],
      date_manufactured: ['date manufactured', 'date_manufactured', 'manufactured date'],
      date_installed_issued: ['date installed', 'date issued', 'date_installed_issued', 'date installed/issued', 'installed date', 'installed/issued'],
      ics: ['ics', 'inventory custodian slip'],
      par: ['par', 'property acknowledgement receipt'],
      date_last_pms: ['date of last pms', 'date_last_pms', 'date last pms', 'last pms'],
      date_last_repair: ['date of last repair', 'date_last_repair', 'date last repair', 'last repair'],
      running_hours: ['running hours', 'running_hours', 'runninghours'],
      quantity: ['quantity', 'qty', 'count', 'qty.'],
      status: ['status'],
      remarks: ['remarks', 'comments'],
      // Ammunition-specific fields
      previous_report: ['previous report', 'previous', 'prev report'],
      expended: ['expended', 'expended qty'],
      replenished: ['replenished', 'replenished qty'],
      balance_on_hand: ['balance on hand', 'balance', 'boh']
    }

    const items: MonthlyReportItem[] = []
    const sectionHeaders = ['weapons', 'communication equipment', 'navigational sensors', 'ict equipment', 'ammunitions', 'ammunition']

    let currentSection: string | null = null
    let currentColumnMap: Record<string, number> | null = null
    let currentRowIndex = 0

    while (currentRowIndex < jsonData.length) {
      const row = jsonData[currentRowIndex]
      if (!row || row.length === 0) {
        currentRowIndex++
        continue
      }

      const firstCell = String(row[0] || '').trim().toLowerCase()

      // Check if this is a section header
      if (sectionHeaders.includes(firstCell)) {
        currentSection = firstCell
        console.log(`[DEBUG] Found section: ${currentSection} at row ${currentRowIndex}`)
        currentRowIndex++

        // Next row should be the column header
        if (currentRowIndex < jsonData.length) {
          const headerRow = jsonData[currentRowIndex]
          if (headerRow && headerRow.length > 0) {
            const headers = headerRow.map((h: any) => String(h).trim().toLowerCase())
            console.log(`[DEBUG] Section ${currentSection} headers:`, headers)

            // Build column map for this section
            currentColumnMap = {}
            for (const [field, possibleNames] of Object.entries(fieldMappings)) {
              for (const name of possibleNames) {
                const useExactOnly = ['ics', 'par'].includes(field)
                const index = headers.findIndex(h => h && (useExactOnly ? h === name : (h === name || h.includes(name))))
                if (index !== -1) {
                  // Skip if this is the Nr column (index 0)
                  const headerValue = headers[index]
                  if (index === 0 && (headerValue === 'nr' || headerValue === 'no' || headerValue === 'number' || headerValue === '#')) {
                    console.log(`[DEBUG] Skipping Nr column at index ${index}`)
                    continue
                  }
                  currentColumnMap[field] = index
                  console.log(`[DEBUG] Section ${currentSection}: Field '${field}' matched to header '${headers[index]}' at index ${index}`)
                  break
                }
              }
            }
            console.log(`[DEBUG] Section ${currentSection} columnMap:`, currentColumnMap)
          }
        }
        currentRowIndex++
        continue
      }

      // If we have a column map, parse this row as data
      if (currentColumnMap && Object.keys(currentColumnMap).length >= 3) {
        const item: MonthlyReportItem = {
          unique_code: String(row[currentColumnMap.unique_code] || '').trim(),
          classification: String(row[currentColumnMap.classification] || '').trim(),
          nomenclature: String(row[currentColumnMap.nomenclature] || '').trim(),
          brand: currentColumnMap.brand ? String(row[currentColumnMap.brand] || '').trim() : '',
          model: currentColumnMap.model ? String(row[currentColumnMap.model] || '').trim() : '',
          serial_number: currentColumnMap.serial_number ? String(row[currentColumnMap.serial_number] || '').trim() : '',
          part_number: currentColumnMap.part_number ? String(row[currentColumnMap.part_number] || '').trim() : '',
          date_manufactured: currentColumnMap.date_manufactured && row[currentColumnMap.date_manufactured] ? String(row[currentColumnMap.date_manufactured]) : null,
          date_installed_issued: currentColumnMap.date_installed_issued && row[currentColumnMap.date_installed_issued] ? String(row[currentColumnMap.date_installed_issued]) : null,
          ics: currentColumnMap.ics ? String(row[currentColumnMap.ics] || '').trim() : '',
          par: currentColumnMap.par ? String(row[currentColumnMap.par] || '').trim() : '',
          date_last_pms: currentColumnMap.date_last_pms && row[currentColumnMap.date_last_pms] ? String(row[currentColumnMap.date_last_pms]) : null,
          date_last_repair: currentColumnMap.date_last_repair && row[currentColumnMap.date_last_repair] ? String(row[currentColumnMap.date_last_repair]) : null,
          running_hours: currentColumnMap.running_hours && row[currentColumnMap.running_hours] ? String(row[currentColumnMap.running_hours]).trim() : null,
          quantity: currentColumnMap.quantity ? extractNumber(row[currentColumnMap.quantity]) : null,
          status: currentColumnMap.status ? String(row[currentColumnMap.status] || '').trim() : '',
          remarks: currentColumnMap.remarks ? String(row[currentColumnMap.remarks] || '').trim() : '',
          // Ammunition-specific fields
          previous_report: currentColumnMap.previous_report ? extractNumber(row[currentColumnMap.previous_report]) : null,
          expended: currentColumnMap.expended ? extractNumber(row[currentColumnMap.expended]) : null,
          replenished: currentColumnMap.replenished ? extractNumber(row[currentColumnMap.replenished]) : null,
          balance_on_hand: currentColumnMap.balance_on_hand ? extractNumber(row[currentColumnMap.balance_on_hand]) : null,
          section: currentSection || undefined
        }

        if (item.unique_code) {
          items.push(item)
        }
      }

      currentRowIndex++
    }

    console.log(`[DEBUG] Total items parsed: ${items.length}`)
    return items
  }

  const parseFilename = (filename: string): ParsedFileInfo | null => {
    const regex = mode === 'monthly' ? /^([A-Z0-9-]+)-(\d{2})(\d{4})\.(xlsx|xls)$/i : /^([A-Z0-9-]+)-(\d{2})(\d{4})\.pdf$/i
    const match = filename.match(regex)
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      await withLoading('Reading file data...', async () => {
        const validTypes = mode === 'monthly'
          ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
          : ['application/pdf']

        if (!validTypes.includes(selectedFile.type)) {
          setError(mode === 'monthly' ? 'Please upload a valid Excel file (.xlsx or .xls)' : 'Please upload a valid PDF file (.pdf)')
          return
        }

        // Parse filename to extract BOW, month, and year
        const parsedInfo = parseFilename(selectedFile.name)
        if (!parsedInfo) {
          setError('Invalid filename format.')
          return
        }

        // Check if report month is in the future (only for monthly mode)
        if (mode === 'monthly') {
          const now = new Date()
          const currentYear = now.getFullYear()
          const currentMonth = now.getMonth() + 1

          if (parsedInfo.year > currentYear || (parsedInfo.year === currentYear && parsedInfo.month > currentMonth)) {
            setError(`Cannot import report in advance. Selected month (${parsedInfo.month_name} ${parsedInfo.year}) is in the future.`)
            return
          }
        }

        setFile(selectedFile)
        setFileInfo(parsedInfo)
        setError(null)
        setSuccess(false)
        setShowPreview(false)

        // Proactively resolve vesselId from BOW number to check report status early
        if (parsedInfo) {
          try {
            const supabase = createClient()
            const { data: vessel } = await supabase
              .from('vessels')
              .select('id')
              .eq('bow_number', parsedInfo.bow_number)
              .single()

            if (vessel) {
              setVesselId(vessel.id)
            } else {
              setVesselId(null)
            }
          } catch (err) {
            console.error('Error resolving vesselId:', err)
            setVesselId(null)
          }
        } else {
          setVesselId(null)
        }
      })
    }
  }

  const handleProcessFile = async () => {
    if (!file || !fileInfo) return

    // Re-verify future month check before processing
    if (mode === 'monthly') {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      if (fileInfo.year > currentYear || (fileInfo.year === currentYear && fileInfo.month > currentMonth)) {
        setError(`Cannot import report in advance. Selected month (${fileInfo.month_name} ${fileInfo.year}) is in the future.`)
        return
      }
    }

    await withLoading('Processing and translating file...', async () => {
      setIsProcessing(true)
      setError(null)

      try {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length < 2) {
          setError('The file appears to be empty or has no data rows')
          setIsProcessing(false)
          return
        }

        // Parse multi-section Excel file
        const items = parseMultiSectionExcel(jsonData)

        if (items.length === 0) {
          setError('No valid data rows found in the file')
          setIsProcessing(false)
          return
        }

        setPreviewData(items)
        setShowPreview(true)
        setSuccess(true)

        // Perform sync check after file processing
        if (fileInfo) {
          await performSyncCheck(items, fileInfo.bow_number, fileInfo.month, fileInfo.year)
        }
      } catch (err) {
        setError('Failed to process the file. Please ensure it is a valid Excel file.')
        console.error('File processing error:', err)
      } finally {
        setIsProcessing(false)
      }
    })
  }

  const handleImport = async (skipConfirm = false) => {
    if (!file) return

    // Block import if there are internal duplicates
    if (syncCheckResults?.internalDuplicates && syncCheckResults.internalDuplicates.length > 0) {
      setError('Cannot import: Duplicate unique codes detected in the file. Please resolve them before importing.')
      return
    }

    // Block import if there are mismatched unique codes
    if (mode === 'monthly' && hasMismatchedUniqueCode) {
      setError(`Cannot import: Mismatched unique codes detected in the file. All unique codes must match the filename reference '${prefixBase}'.`)
      return
    }

    // Check if report month is in the future (only for monthly mode)
    if (mode === 'monthly' && fileInfo) {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      if (fileInfo.year > currentYear || (fileInfo.year === currentYear && fileInfo.month > currentMonth)) {
        setError(`Cannot import report in advance. Selected month (${fileInfo.month_name} ${fileInfo.year}) is in the future.`)
        return
      }
    }

    // Check if report already exists and we need confirmation
    if (mode === 'monthly' && reportStatus.exists && !skipConfirm) {
      setShowOverwriteConfirm(true)
      return
    }

    setShowOverwriteConfirm(false)

    let importSuccessful = false
    let vesselName = ''
    let reportMonth = ''

    await withLoading(mode === 'monthly' ? 'Synchronizing with Masterlist...' : 'Uploading report...', async () => {
      setIsImporting(true)
      setError(null)

      try {
        const supabase = createClient()
        const user = await getAuthUser()
        if (!user) throw new Error('Not authenticated')

        const token = await getValidAccessToken()
        if (!token) throw new Error('Not authenticated')

        // Convert file to base64 using chunked approach to avoid call stack overflow on large files
        const fileBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(fileBuffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize))
        }
        const base64 = btoa(binary)
        const fileData = `data:${file.type};base64,${base64}`

        // Call edge function to import report
        const functionName = mode === 'monthly' ? 'import-monthly-report' : 'import-derangement-report'
        const { data, error: functionError } = await supabase.functions.invoke(functionName, {
          body: {
            file_data: fileData,
            filename: file.name
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (functionError) {
          throw new Error(functionError.message || 'Failed to import report')
        }

        if (data?.error) {
          throw new Error(data.error)
        }

        // Capture file info before clearing state for the notification
        vesselName = fileInfo?.bow_number || 'Unknown Vessel'
        reportMonth = fileInfo ? `${fileInfo.month_name} ${fileInfo.year}` : ''

        setSuccess(true)
        setFile(null)
        setPreviewData([])
        setFileInfo(null)
        setShowPreview(false)
        setSyncCheckResults(null)
        setVesselId(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        refreshRecentImports()
        importSuccessful = true
      } catch (err: any) {
        setError(err.message || 'Failed to import report')
      } finally {
        setIsImporting(false)
      }
    })

    // Show success modal only after loading is complete
    if (importSuccessful) {
      setSuccessModalData({
        title: 'Import Successful',
        message: mode === 'monthly'
          ? `Monthly report for ${vesselName} — ${reportMonth} imported successfully.`
          : `Derangement report for ${vesselName} — ${reportMonth} uploaded successfully.`
      })
      setShowSuccessModal(true)
    }
  }

  const handleReset = () => {
    setFile(null)
    setError(null)
    setSuccess(false)
    setShowPreview(false)
    setPreviewData([])
    setFileInfo(null)
    setSyncCheckResults(null)
    setVesselId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <h1 className="text-[20px] font-semibold text-foreground">
          {mode === 'monthly' ? 'Import Monthly Report' : 'Equipment Derangement Reports'}
        </h1>
        <p className="text-sm text-foreground-muted">
          {mode === 'monthly'
            ? 'Upload your monthly inventory report in Excel format to update the system.'
            : 'Upload your Derangement Reports in PDF format to Add in the system.'}
        </p>
      </div>

      {mode === 'monthly' && fileInfo && (
        <div className="  bg-surface p-3 shadow-card border border-foreground/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-foreground mb-1">Report Details</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-foreground-muted">Vessel: <span className="text-foreground font-medium">{fileInfo.bow_number}</span></span>
                <span className="text-foreground-muted">Month: <span className="text-foreground font-medium">{fileInfo.month_name} {fileInfo.year}</span></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {checkingReportStatus ? (
                <span className="text-sm text-foreground-muted">Checking...</span>
              ) : reportStatus.exists ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Report Submitted</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-foreground-muted">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Not Submitted</span>
                </div>
              )}
            </div>
          </div>
          {reportStatus.exists && (
            <div className="mt-4 flex items-center gap-2 text-sm text-warning bg-warning-bg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>A report for this vessel and month has already been submitted. Importing will replace the existing report.</span>
            </div>
          )}
        </div>
      )}

      {!(mode === 'monthly' && showPreview) && (
        <div className="bg-surface p-4 shadow-card border border-foreground/10">
          <div className="border-2 border-dashed border-foreground/20 p-3 text-center hover:border-foreground/40 transition-colors">
            <div className="w-16 h-16 bg-secondary/20 flex items-center justify-center mx-auto mb-4">
              {mode === 'monthly' ? (
                <FileSpreadsheet className="w-8 h-8 text-foreground" aria-hidden="true" />
              ) : (
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-none border border-primary/20">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              )}
            </div>
            <h4 className="text-[16px] font-semibold text-foreground mb-2">
              {mode === 'monthly' ? 'Upload Monthly Report' : 'Upload Derangement Report'}
            </h4>
            <p className="text-sm text-foreground-muted mb-4 max-w-md mx-auto">
              {mode === 'monthly'
                ? 'Upload an Excel file (.xlsx or .xls) containing the monthly inventory report.'
                : 'Upload a PDF file (.pdf) containing the equipment derangement report.'}
            </p>
            <div className="flex items-center justify-center gap-2 mb-4 text-xs text-foreground-muted">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>
                {mode === 'monthly'
                  ? 'Reports should be named with the vessel slug and date (e.g., PS176-052026.xlsx)'
                  : 'Reports should be named with the vessel slug and date (e.g., PS176-052026.pdf)'}
              </span>
            </div>

            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept={mode === 'monthly' ? ".xlsx,.xls" : ".pdf"}
              onChange={handleFileChange}
              ref={fileInputRef}
            />

            {!file ? (
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 bg-accent text-white px-6 py-2.5 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card cursor-pointer"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Select File
              </label>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 bg-foreground/5 py-2 px-4 border border-foreground/10">
                  {mode === 'monthly' ? (
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                  ) : (
                    <FileText className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-xs font-bold text-foreground truncate max-w-[200px]">{file.name}</span>
                  <button
                    onClick={() => {
                      setFile(null)
                      setFileInfo(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-foreground-muted hover:text-red-500 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  {mode === 'monthly' ? (
                    <button
                      onClick={handleProcessFile}
                      disabled={isProcessing}
                      className="bg-primary text-background px-6 py-2.5 hover:bg-primary/90 disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                    >
                      {isProcessing ? 'Processing...' : 'Process File'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleImport()}
                      disabled={isImporting}
                      className="bg-primary text-background px-6 py-2.5 hover:bg-primary/90 disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                    >
                      {isImporting ? 'Uploading...' : 'Upload Report'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest leading-relaxed">
            {error}
          </p>
        </div>
      )}

      {mode === 'monthly' && showPreview && syncCheckResults && (
        <div className="bg-surface p-3 shadow-card border border-foreground/10">
          <div className="flex items-center justify-between p-4 bg-secondary/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary flex items-center justify-center">
                <Check className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">File Ready for Import</p>
                <p className="text-xs text-foreground-muted">{file?.name} • {previewData.length} items</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="text-sm text-foreground-muted hover:text-foreground transition-colors">
                Upload different file
              </button>
            </div>
          </div>

          {(syncCheckResults.notOnMasterlist.length > 0 || syncCheckResults.missedItems.length > 0 || syncCheckResults.internalDuplicates.length > 0 || syncCheckResults.mismatched.length > 0 || hasMismatchedUniqueCode) && (
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-2 text-sm text-error bg-error-bg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">Import blocked. Please fix the report discrepancies before importing:</span>
                  <ul className="list-disc pl-5 mt-1.5 space-y-1 text-xs">
                    {mismatchedFilenameItems.length > 0 && (
                      <li>{mismatchedFilenameItems.length} unique code(s) do not match the filename reference prefix '{prefixBase}'.</li>
                    )}
                    {syncCheckResults.notOnMasterlist.length > 0 && (
                      <li>{syncCheckResults.notOnMasterlist.length} item(s) not on the masterlist.</li>
                    )}
                    {syncCheckResults.missedItems.length > 0 && (
                      <li>{syncCheckResults.missedItems.length} item(s) missing from the report compared to the masterlist.</li>
                    )}
                    {syncCheckResults.internalDuplicates.length > 0 && (
                      <li>{syncCheckResults.internalDuplicates.length} duplicate unique code(s) detected in the file.</li>
                    )}
                    {syncCheckResults.mismatched.length > 0 && (
                      <li>{syncCheckResults.mismatched.length} item(s) with mismatched specifications.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="bg-surface border border-foreground/10 p-4 shadow-card space-y-4">
                <div className="flex items-center gap-2 border-b border-foreground/10 pb-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
                    Discrepancy Overview
                  </h4>
                </div>

                {mismatchedFilenameItems.length > 0 && (
                  <div className="border border-foreground/10 overflow-hidden bg-background">
                    <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#000080] flex items-center gap-1.5">
                        <span>⚠ Unique Codes Mismatched with Filename ({prefixBase})</span>
                      </h5>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20">
                        {mismatchedFilenameItems.length} Mismatched
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#E6E6FA] text-[#000033] border-b border-foreground/10">
                          <tr>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest">Unique Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest">Nomenclature</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest">Classification</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest">Section</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium text-foreground">
                          {mismatchedFilenameItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-foreground/5 transition-colors">
                              <td className="px-4 py-2 font-mono font-black text-red-500 text-xs">{item.unique_code}</td>
                              <td className="px-4 py-2 text-xs">{item.nomenclature}</td>
                              <td className="px-4 py-2 text-foreground-muted text-xs">{item.classification}</td>
                              <td className="px-4 py-2 text-foreground-muted text-xs">{item.section || 'Uncategorized'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {syncCheckResults.missedItems.length > 0 && (
                  <div className="border border-foreground/10 overflow-hidden bg-background">
                    <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        <span>▼ Missed Items in Report</span>
                      </h5>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20">
                        {syncCheckResults.missedItems.length} Missing
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-foreground/5 border-b border-foreground/10">
                          <tr>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Equipment Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium text-foreground">
                          {syncCheckResults.missedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-foreground/5 transition-colors">
                              <td className="px-4 py-2 font-mono font-black text-primary text-xs">{item.unique_code}</td>
                              <td className="px-4 py-2 text-xs">{item.nomenclature}</td>
                              <td className="px-4 py-2 text-foreground-muted font-bold text-xs">{item.equipment_code}</td>
                              <td className="px-4 py-2 text-foreground-muted text-xs">{item.classification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {syncCheckResults.notOnMasterlist.length > 0 && (
                  <div className="border border-foreground/10 overflow-hidden bg-background">
                    <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        <span>▲ Report Items Not on Masterlist</span>
                      </h5>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20">
                        {syncCheckResults.notOnMasterlist.length} Items Not on Masterlist
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-foreground/5 border-b border-foreground/10">
                          <tr>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Serial Number</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium text-foreground">
                          {syncCheckResults.notOnMasterlist.map((item, idx) => (
                            <tr key={idx} className="hover:bg-foreground/5 transition-colors">
                              <td className="px-4 py-2 font-mono font-black text-primary text-xs">{item.unique_code}</td>
                              <td className="px-4 py-2 text-xs">{item.nomenclature}</td>
                              <td className="px-4 py-2 text-foreground-muted text-xs">{item.classification}</td>
                              <td className="px-4 py-2 text-foreground-muted text-xs">{item.serial_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {mismatchedStandard.length > 0 && (
                  <div className="border border-foreground/10 overflow-hidden bg-background">
                    <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        <span>⚠ Mismatched Specification Items</span>
                      </h5>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20">
                        {mismatchedStandard.length} Mismatched
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-foreground/5 border-b border-foreground/10">
                          <tr>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Status</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Unique Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Classification</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Nomenclature</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Brand</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Model</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Serial Number</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Part Number</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Date Manufactured</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Date Installed/Issued</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">ICS</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">PAR</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Date of Last PMs</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Date of Last Repair</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Running Hours</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Status (Condition)</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium text-foreground">
                          {mismatchedStandard.map((item, idx) => (
                            <tr key={idx} className="hover:bg-foreground/5 transition-colors">
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-error/20 text-error">
                                  {item.syncStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2 font-mono font-black text-primary text-xs whitespace-nowrap">{item.unique_code}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('classification') ? 'bg-error/20 text-error' : ''}`}>{item.classification || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('nomenclature') ? 'bg-error/20 text-error' : ''}`}>{item.nomenclature || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('brand') ? 'bg-error/20 text-error' : ''}`}>{item.brand || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('model') ? 'bg-error/20 text-error' : ''}`}>{item.model || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('serial_number') ? 'bg-error/20 text-error' : ''}`}>{item.serial_number || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('part_number') ? 'bg-error/20 text-error' : ''}`}>{item.part_number || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('date_manufactured') ? 'bg-error/20 text-error' : ''}`}>{formatPreviewDate(item.date_manufactured)}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap ${item.mismatchedFields?.includes('date_installed_issued') ? 'bg-error/20 text-error' : ''}`}>{formatPreviewDate(item.date_installed_issued)}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{item.ics || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{item.par || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{formatPreviewDate(item.date_last_pms)}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{formatPreviewDate(item.date_last_repair)}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{item.running_hours || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{item.status || '-'}</td>
                              <td className={`px-4 py-2 text-xs whitespace-nowrap`}>{item.remarks || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {mismatchedAmmunition.length > 0 && (
                  <div className="border border-foreground/10 overflow-hidden bg-background">
                    <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        <span>⚠ Mismatched Ammunition Items</span>
                      </h5>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20">
                        {mismatchedAmmunition.length} Mismatched
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-foreground/5 border-b border-foreground/10">
                          <tr>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Previous Report</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Expended</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Replenished</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Balance on Hand</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium text-foreground">
                          {mismatchedAmmunition.map((item, idx) => (
                            <tr key={idx} className="hover:bg-foreground/5 transition-colors">
                              <td className="px-4 py-2 text-xs">
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-error/20 text-error">
                                  {item.syncStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2 font-mono font-black text-primary text-xs">{item.unique_code}</td>
                              <td className={`px-4 py-2 text-xs ${item.mismatchedFields?.includes('classification') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.classification || '-'}</td>
                              <td className={`px-4 py-2 text-xs ${item.mismatchedFields?.includes('nomenclature') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.nomenclature || '-'}</td>
                              <td className={`px-4 py-2 text-xs ${item.mismatchedFields?.includes('previous_report') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.previous_report ?? '-'}</td>
                              <td className={`px-4 py-2 text-xs ${item.mismatchedFields?.includes('expended') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.expended ?? '-'}</td>
                              <td className={`px-4 py-2 text-xs ${item.mismatchedFields?.includes('replenished') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.replenished ?? '-'}</td>
                              <td className={`px-4 py-2 text-xs ${item.mismatchedFields?.includes('balance_on_hand') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.balance_on_hand ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {syncCheckResults.internalDuplicates.length > 0 && (
                  <div className="border border-foreground/10 overflow-hidden bg-background">
                    <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        <span>⧉ Duplicate Codes in File</span>
                      </h5>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20">
                        {syncCheckResults.internalDuplicates.length} Duplicates
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-foreground/5 border-b border-foreground/10">
                          <tr>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5 font-medium text-foreground">
                          {syncCheckResults.internalDuplicates.map((item, idx) => (
                            <tr key={idx} className="hover:bg-foreground/5 transition-colors">
                              <td className="px-4 py-2 font-mono font-black text-primary text-xs">{item.unique_code}</td>
                              <td className="px-4 py-2 text-xs">{item.nomenclature}</td>
                              <td className="px-4 py-2 text-foreground-muted text-xs">{item.classification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => handleImport()}
              disabled={isImporting || Boolean(syncCheckResults.notOnMasterlist.length > 0 || syncCheckResults.missedItems.length > 0 || syncCheckResults.internalDuplicates.length > 0 || syncCheckResults.mismatched.length > 0 || hasMismatchedUniqueCode)}
              className="bg-accent text-white px-6 py-3 hover:bg-secondary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
            >
              {isImporting ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {mode === 'monthly' && showPreview && previewData.length > 0 && (
        <div className="bg-surface p-3 shadow-card border border-foreground/10 mt-6">
          <h3 className="text-[16px] font-semibold text-foreground mb-4">Preview Data ({previewData.length} items)</h3>
          {sortedGroupedEquipmentCodes.map((equipmentCode) => {
            const equipment = equipments[equipmentCode]
            const items = groupedItems[equipmentCode]
            if (!items || items.length === 0) return null

            const isAmmunitionSection =
              equipment?.equipment_type === 'ammunitions' ||
              equipment?.equipment_type === 'ammunition' ||
              equipmentCode.toLowerCase().includes('ammunition') ||
              items.some(item => item.section === 'ammunitions' || item.section === 'ammunition')

            const isNavigationalSensorsSection =
              !isAmmunitionSection && (
                equipment?.equipment_type === 'ne' ||
                equipment?.equipment_type === 'navigational' ||
                equipment?.equipment_type?.toLowerCase().includes('navig') ||
                equipmentCode.toLowerCase().includes('navigational') ||
                equipmentCode.toUpperCase().startsWith('NE') ||
                items.some(item => item.section === 'navigational sensors')
              )

            return (
              <div key={equipmentCode} className="border border-foreground/10 overflow-hidden mb-4 last:mb-0">
                <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{equipment?.name || equipmentCode}</h4>
                  <p className="text-xs text-foreground-muted">{equipmentCode} • {items.length} items</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap min-w-max">
                    <thead className="bg-foreground/5">
                      {isAmmunitionSection ? (
                        <tr>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Previous Report</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Expended</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Replenished</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Balance on Hand</th>
                        </tr>
                      ) : isNavigationalSensorsSection ? (
                        <tr>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Brand</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Model</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Serial Number</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Part Number</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date Manufactured</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date Issued</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date of Last PMS</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date of Last Repair</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">ICS</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">PAR</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Remarks</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Running Hours</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Classification</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Brand</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Model</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Serial Number</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Part Number</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date Manufactured</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date Issued</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date of Last PMS</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Date of Last Repair</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">ICS</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">PAR</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Remarks</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-foreground/5">
                      {items.map((item, idx) => {
                        const isMismatched = mode === 'monthly' && prefixBase && item.unique_code && !item.unique_code.toLowerCase().includes(prefixBase.toLowerCase());
                        return (
                          <tr key={idx} className={`hover:bg-foreground/5 transition-colors ${isMismatched ? 'bg-red-500/5' : ''}`}>
                            <td className="px-3 py-2 text-xs">
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${isMismatched ? 'bg-red-100 text-red-800 border border-red-300' :
                                item.syncStatus === 'sync' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                                }`}>
                                {isMismatched ? 'mismatched' : item.syncStatus}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-sm font-medium ${isMismatched ? 'text-red-500 font-bold font-mono' : ''}`}>{item.unique_code}</td>
                            {isAmmunitionSection ? (
                              <>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('classification') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.classification || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('nomenclature') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.nomenclature || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('previous_report') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.previous_report ?? '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('expended') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.expended ?? '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('replenished') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.replenished ?? '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('balance_on_hand') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.balance_on_hand ?? '-'}</td>
                              </>
                            ) : isNavigationalSensorsSection ? (
                              <>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('classification') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.classification || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('nomenclature') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.nomenclature || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('brand') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.brand || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('model') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.model || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('serial_number') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.serial_number || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('part_number') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.part_number || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_manufactured') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_manufactured ? formatPreviewDate(item.date_manufactured) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_installed_issued') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_installed_issued ? formatPreviewDate(item.date_installed_issued) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_last_pms') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_last_pms ? formatPreviewDate(item.date_last_pms) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_last_repair') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_last_repair ? formatPreviewDate(item.date_last_repair) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('ics') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.ics || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('par') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.par || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('status') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.status || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('remarks') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.remarks || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('running_hours') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.running_hours || '-'}</td>
                              </>
                            ) : (
                              <>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('classification') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.classification || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('nomenclature') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.nomenclature || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('brand') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.brand || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('model') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.model || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('serial_number') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.serial_number || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('part_number') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.part_number || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_manufactured') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_manufactured ? formatPreviewDate(item.date_manufactured) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_installed_issued') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_installed_issued ? formatPreviewDate(item.date_installed_issued) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_last_pms') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_last_pms ? formatPreviewDate(item.date_last_pms) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('date_last_repair') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.date_last_repair ? formatPreviewDate(item.date_last_repair) : '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('ics') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.ics || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('par') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.par || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('status') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.status || '-'}</td>
                                <td className={`px-3 py-2 text-sm ${item.mismatchedFields?.includes('remarks') ? 'bg-error/20 text-error font-bold' : ''}`}>{item.remarks || '-'}</td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-surface p-3 shadow-card border border-foreground/10">
        <h3 className="text-[16px] font-semibold text-foreground mb-4">Recent Imports</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Vessel</th>
                <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Report Month</th>
                <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Imported</th>
                <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">By</th>
                {mode === 'derangement' && <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {loadingRecent ? (
                <tr>
                  <td colSpan={mode === 'derangement' ? 5 : 4} className="py-8 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                    Loading recent imports...
                  </td>
                </tr>
              ) : displayedImports.length === 0 ? (
                <tr>
                  <td colSpan={mode === 'derangement' ? 5 : 4} className="py-8 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                    No recent imports found
                  </td>
                </tr>
              ) : (
                displayedImports.map((item) => (
                  <tr key={item.id} className="hover:bg-foreground/5 transition-colors">
                    <td className="py-3 px-2 text-sm font-semibold text-foreground">{item.vessel_name}</td>
                    <td className="py-3 px-2 text-sm text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        {formatReportMonth(item.report_month)}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-foreground-muted">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatDateForDisplay(item.created_at)}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-xs text-foreground-muted">
                      <div className="max-w-[120px] truncate font-medium uppercase" title={item.importer_name}>
                        {item.importer_name}
                      </div>
                    </td>
                    {mode === 'derangement' && (
                      <td className="py-3 px-2 text-right">
                        <a
                          href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/derangement-reports/${(item as any).file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                        >
                          <Eye className="w-3 h-3" />
                          View PDF
                        </a>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Import Success Modal ── */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalData.title}
        message={successModalData.message}
      />

      {/* ── Overwrite Confirmation Modal ── */}
      <ConfirmModal
        isOpen={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        onConfirm={() => handleImport(true)}
        title="Confirm Overwrite"
        message={`Overwrite previously imported file for ${fileInfo?.month_name} ${fileInfo?.year} of ${fileInfo?.bow_number}?`}
        confirmText="Overwrite"
        cancelText="Cancel"
      />

      <LoadingOverlay isOpen={isGlobalLoading} message={loadingMessage} />
    </div>
  )
}
