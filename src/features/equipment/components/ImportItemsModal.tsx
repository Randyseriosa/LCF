'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'
import { formatDateToDDMMYYYY, formatDateToISO } from '@/utils/dateUtils'

interface ImportItem {
    unique_code: string
    classification: string
    nomenclature: string
    brand: string
    model: string
    serial_number: string
    part_number: string
    date_manufactured: string
    date_installed_issued: string
    ics: string
    par: string
    quantity: number | null
    date_last_pms?: string
    date_last_repair?: string
    running_hours?: number | null
    remarks?: string
    item_data_status?: string
    status?: 'new' | 'duplicate' | 'not_on_masterlist' | 'missed' | 'internal_duplicate' | 'overwrite'
    originalDbItem?: any
}

export interface ParsedFileInfo {
    slug?: string
    month?: number // 1-12
    year?: number
    month_name?: string
    bow_number?: string
    isMasterlist?: boolean
    isHqInventory?: boolean
}

/**
 * Parse filename to extract slug, month, and year, or bow number for masterlist.
 * Formats: 
 * 1. "HQSLUG-MMYYYY.xlsx" -> slug, month (1-12), year
 * 2. "BOWNUMBER-masterlist.xlsx" -> bow_number, isMasterlist
 */
function parseFilenameInfo(filename: string): ParsedFileInfo | null {
    // Check for monthly report format: SLUG-MMYYYY
    const reportMatch = filename.match(/^([A-Za-z0-9-]+)-(\d{2})(\d{4})\.(xlsx|xls)$/i)
    if (reportMatch) {
        const [, slug, monthStr, yearStr] = reportMatch
        const month = parseInt(monthStr, 10)
        const year = parseInt(yearStr, 10)
        if (month < 1 || month > 12) return null
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        return { slug, month, year, month_name: monthNames[month - 1] }
    }

    // Check for masterlist format: BOW-masterlist
    const masterlistMatch = filename.match(/^([A-Za-z0-9-]+)-masterlist\.(xlsx|xls)$/i)
    if (masterlistMatch) {
        const [, bow_number] = masterlistMatch
        return { bow_number, isMasterlist: true }
    }

    return null
}

/**
 * Extract prefix base from filename for verification comparison.
 */
function extractFilenamePrefix(filename: string): string {
    const nameWithoutExt = filename.replace(/\.(xlsx|xls)$/i, '')
    const masterlistMatch = nameWithoutExt.match(/^([A-Za-z0-9-]+)-masterlist$/i)
    if (masterlistMatch) {
        return masterlistMatch[1]
    }
    const reportMatch = nameWithoutExt.match(/^([A-Za-z0-9-]+)-\d{6}$/)
    if (reportMatch) {
        return reportMatch[1]
    }
    const parts = nameWithoutExt.split(/[-_]/)
    if (parts.length > 0 && parts[0]) {
        return parts[0]
    }
    return nameWithoutExt
}


interface ImportItemsModalProps {
    isOpen: boolean
    onClose: () => void
    equipmentId?: string
    equipmentName?: string
    equipmentUniqueCode?: string
    onImportComplete: (info?: ParsedFileInfo | null) => void
    isHqInventory?: boolean
    isMonthlyReport?: boolean
    month?: number
    year?: number
    title?: string
    subtitle?: string
}

export function ImportItemsModal({
    isOpen,
    onClose,
    equipmentId,
    equipmentName,
    equipmentUniqueCode,
    onImportComplete,
    isHqInventory,
    isMonthlyReport,
    month,
    year,
    title,
    subtitle
}: ImportItemsModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<ImportItem[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)
    const [equipments, setEquipments] = useState<Record<string, { id: string; name: string; equipment_type: string | null }>>({})
    const [parsedFileInfo, setParsedFileInfo] = useState<ParsedFileInfo | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showConfirmOverwriteModal, setShowConfirmOverwriteModal] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [monthlyReportExists, setMonthlyReportExists] = useState(false)
    const [showMonthlyReportOverwriteConfirm, setShowMonthlyReportOverwriteConfirm] = useState(false)

    // Verification-specific states
    const [activeTab, setActiveTab] = useState<'import' | 'verify'>('import')
    const [verifyFile, setVerifyFile] = useState<File | null>(null)
    const [verifiedData, setVerifiedData] = useState<{
        unique_code: string;
        classification: string;
        nomenclature: string;
        brand: string;
        model: string;
        serial_number: string;
        part_number: string;
        date_manufactured: string;
        date_installed_issued: string;
        ics: string;
        par: string;
        isMatched: boolean;
        isDuplicate: boolean;
        rowNum: number;
    }[]>([])
    const [isVerifying, setIsVerifying] = useState(false)
    const [verificationError, setVerificationError] = useState<string | null>(null)
    const [verifiedPrefix, setVerifiedPrefix] = useState<string | null>(null)

    // Fetch equipment data when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchEquipments()
        } else {
            // Reset all state when modal closes
            setFile(null)
            setParsedData([])
            setError(null)
            setIsProcessing(false)
            setIsImporting(false)
            setIsSuccess(false)
            setParsedFileInfo(null)
            setShowConfirmOverwriteModal(false)
            setShowSuccessModal(false)

            setActiveTab('import')
            setVerifyFile(null)
            setVerifiedData([])
            setIsVerifying(false)
            setVerificationError(null)
            setVerifiedPrefix(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const handleTabChange = (tab: 'import' | 'verify') => {
        setActiveTab(tab)
        // Reset states for clean transition
        setFile(null)
        setParsedData([])
        setError(null)
        setIsProcessing(false)
        setIsImporting(false)
        setIsSuccess(false)
        setParsedFileInfo(null)
        setShowConfirmOverwriteModal(false)
        setShowSuccessModal(false)

        setVerifyFile(null)
        setVerifiedData([])
        setIsVerifying(false)
        setVerificationError(null)
        setVerifiedPrefix(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleVerifyFilter = async () => {
        if (!verifyFile) return

        setIsVerifying(true)
        setVerificationError(null)
        setVerifiedData([])

        try {
            const prefix = extractFilenamePrefix(verifyFile.name)
            setVerifiedPrefix(prefix)

            const data = await verifyFile.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            if (jsonData.length < 2) {
                setVerificationError('The file appears to be empty or has no data rows')
                setIsVerifying(false)
                return
            }

            // Find header row to detect column positions
            let headerRowIndex = -1
            let columnMap: Record<string, number> = {}

            for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
                const row = jsonData[i]
                if (!row || row.length === 0) continue

                const firstCol = String(row[0] || '').trim().toLowerCase()
                if (firstCol === 'nr' || firstCol === 'no' || firstCol === 'number' || firstCol === '#') {
                    headerRowIndex = i
                    row.forEach((header: any, index: number) => {
                        const headerName = String(header).trim().toLowerCase()
                        if (headerName.includes('unique code') || headerName === 'unique_code' || headerName === 'uniquecode') columnMap.unique_code = index
                        else if (headerName.includes('classification') || headerName === 'class') columnMap.classification = index
                        else if (headerName.includes('nomenclature') || headerName === 'name' || headerName === 'item name' || headerName === 'description') columnMap.nomenclature = index
                        else if (headerName.includes('brand') || headerName.includes('manufacturer')) columnMap.brand = index
                        else if (headerName === 'model') columnMap.model = index
                        else if (headerName.includes('serial') || headerName === 'serial_number' || headerName === 'serialno') columnMap.serial_number = index
                        else if (headerName.includes('part') || headerName === 'part_number' || headerName === 'partno') columnMap.part_number = index
                        else if (headerName.includes('date manufactured') || headerName === 'date_manufactured' || headerName === 'manufactured date') columnMap.date_manufactured = index
                        else if (headerName.includes('date installed') || headerName.includes('date issued') || headerName === 'date_installed_issued' || headerName.includes('installed/issued')) columnMap.date_installed_issued = index
                        else if (headerName === 'ics' || headerName.includes('inventory custodian')) columnMap.ics = index
                        else if (headerName === 'par' || headerName.includes('property acknowledgement')) columnMap.par = index
                    })
                    break
                }
            }

            // Filter rows to valid data rows
            const rowsWithIndex = jsonData
                .map((row, rowIndex) => ({ row, rowIndex }))
                .filter(({ row, rowIndex }) => {
                    if (rowIndex === headerRowIndex) return false
                    if (row.length === 0) return false

                    const firstCol = row[0]?.toString().trim().toLowerCase()
                    if (firstCol === 'nr' || firstCol === 'no' || firstCol === 'number' || firstCol === '#') {
                        return false
                    }

                    const uniqueCode = columnMap.unique_code !== undefined
                        ? row[columnMap.unique_code]?.toString().trim()
                        : row[1]?.toString().trim()

                    if (!uniqueCode) return false

                    const headerKeywords = ['unique code', 'classification', 'nomenclature', 'brand', 'serial', 'part']
                    const lowerCode = uniqueCode.toLowerCase()
                    if (headerKeywords.some(keyword => lowerCode.includes(keyword))) return false

                    const isCategoryName = /^[A-Za-z\s]+$/.test(uniqueCode) && !uniqueCode.includes('-')
                    if (isCategoryName) return false

                    return true
                })

            // Track internal duplicates
            const counts = new Map<string, number>()
            rowsWithIndex.forEach(({ row }) => {
                const uniqueCode = columnMap.unique_code !== undefined
                    ? row[columnMap.unique_code]?.toString().trim() || ''
                    : row[1]?.toString().trim() || ''
                if (uniqueCode) {
                    counts.set(uniqueCode, (counts.get(uniqueCode) || 0) + 1)
                }
            })

            const items = rowsWithIndex.map(({ row, rowIndex }) => {
                const uniqueCode = columnMap.unique_code !== undefined
                    ? row[columnMap.unique_code]?.toString().trim() || ''
                    : row[1]?.toString().trim() || ''
                const classification = columnMap.classification !== undefined
                    ? row[columnMap.classification]?.toString().trim() || ''
                    : row[2]?.toString().trim() || ''
                const nomenclature = columnMap.nomenclature !== undefined
                    ? row[columnMap.nomenclature]?.toString().trim() || ''
                    : row[3]?.toString().trim() || ''
                const brand = columnMap.brand !== undefined
                    ? row[columnMap.brand]?.toString().trim() || ''
                    : ''
                const model = columnMap.model !== undefined
                    ? row[columnMap.model]?.toString().trim() || ''
                    : ''
                const serial_number = columnMap.serial_number !== undefined
                    ? row[columnMap.serial_number]?.toString().trim() || ''
                    : ''
                const part_number = columnMap.part_number !== undefined
                    ? row[columnMap.part_number]?.toString().trim() || ''
                    : ''
                const date_manufactured = columnMap.date_manufactured !== undefined
                    ? formatDateToISO(row[columnMap.date_manufactured] || '') || ''
                    : ''
                const date_installed_issued = columnMap.date_installed_issued !== undefined
                    ? formatDateToISO(row[columnMap.date_installed_issued] || '') || ''
                    : ''
                const ics = columnMap.ics !== undefined
                    ? row[columnMap.ics]?.toString().trim() || ''
                    : ''
                const par = columnMap.par !== undefined
                    ? row[columnMap.par]?.toString().trim() || ''
                    : ''

                // Check if uniqueCode contains filename prefix case-insensitively
                const isMatched = uniqueCode.toLowerCase().includes(prefix.toLowerCase())
                const isDuplicate = (counts.get(uniqueCode) || 0) > 1

                return {
                    unique_code: uniqueCode,
                    classification,
                    nomenclature,
                    brand,
                    model,
                    serial_number,
                    part_number,
                    date_manufactured,
                    date_installed_issued,
                    ics,
                    par,
                    isMatched,
                    isDuplicate,
                    rowNum: rowIndex + 1
                }
            })

            if (items.length === 0) {
                setVerificationError('No valid items found in the file to verify.')
            } else {
                setVerifiedData(items)
            }
        } catch (err) {
            console.error('File verification error:', err)
            setVerificationError('Failed to process and verify the file. Please ensure it is a valid Excel file.')
        } finally {
            setIsVerifying(false)
        }
    }

    const fetchEquipments = async () => {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('equipments')
                .select('id, unique_code, name, equipment_type')

            if (error) throw error

            // Create a map of unique_code -> { id, name, equipment_type }
            const equipmentMap: Record<string, { id: string; name: string; equipment_type: string | null }> = {}
            data?.forEach(equip => {
                if (equip.unique_code && equip.id) {
                    equipmentMap[equip.unique_code] = { id: equip.id, name: equip.name, equipment_type: equip.equipment_type }
                }
            })

            setEquipments(equipmentMap)
        } catch (err) {
            console.error('Error fetching equipments:', err)
        }
    }

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            const validTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'
            ]
            if (!validTypes.includes(selectedFile.type)) {
                setError('Please upload a valid Excel file (.xlsx or .xls)')
                return
            }

            // For HQ Monthly Report, parse filename to extract month/year automatically
            if (isHqInventory && isMonthlyReport) {
                const info = parseFilenameInfo(selectedFile.name)
                if (!info || !info.month) {
                    setError('Invalid filename format.')
                    return
                }
                if (info) info.isHqInventory = isHqInventory
                setParsedFileInfo(info)
            }

            // For Masterlist import, enforce (Bow number)-masterlist.xlsx
            if (!isMonthlyReport && !isHqInventory) {
                const info = parseFilenameInfo(selectedFile.name)
                if (!info || !info.isMasterlist) {
                    setError('Invalid filename format.')
                    return
                }
                if (info) info.isHqInventory = isHqInventory
                setParsedFileInfo(info)
            }

            if (!isMonthlyReport && isHqInventory) {
                const info = parseFilenameInfo(selectedFile.name)
                if (!info || !info.isMasterlist || info.bow_number?.toUpperCase() !== 'OLCF6') {
                    setError('Invalid filename format. Should only accept OLCF6-masterlist.xlsx')
                    return
                }
                if (info) info.isHqInventory = isHqInventory
                setParsedFileInfo(info)
            }

            setFile(selectedFile)
            setError(null)
            setParsedData([])
        }
    }

    const handleProcessFile = async () => {
        if (!file) return

        setIsProcessing(true)
        setError(null)

        try {
            // Validate vessel existence if bow_number or slug is present (Masterlist or Monthly Report)
            if (parsedFileInfo?.bow_number || parsedFileInfo?.slug) {
                const supabase = createClient()
                let query = supabase.from('vessels').select('id')

                if (parsedFileInfo.bow_number) {
                    query = query.eq('bow_number', parsedFileInfo.bow_number.toUpperCase())
                } else if (parsedFileInfo.slug) {
                    const cleanSlug = parsedFileInfo.slug.toLowerCase()
                    if (cleanSlug === 'hq' || cleanSlug === 'olcf6' || cleanSlug === 'olcf') {
                        query = query.eq('slug', 'hq-inventory')
                    } else {
                        query = query.or(`slug.eq.${cleanSlug},bow_number.eq.${parsedFileInfo.slug.toUpperCase()}`)
                    }
                }

                const { data: vessel, error: vesselError } = await query.maybeSingle()

                if (vesselError) {
                    console.error('Vessel verification error:', vesselError)
                    throw new Error('Error verifying vessel registration: ' + vesselError.message)
                }

                if (!vessel) {
                    const identifier = parsedFileInfo.bow_number || parsedFileInfo.slug
                    setError(`Vessel '${identifier}' not found. Please ask Admin to register this vessel first.`)
                    setIsProcessing(false)
                    return
                }

                // Check if a monthly report has already been submitted for this vessel and month
                if (vessel && isMonthlyReport && parsedFileInfo?.month && parsedFileInfo?.year) {
                    const reportMonthStr = `${parsedFileInfo.year}-${String(parsedFileInfo.month).padStart(2, '0')}-01`
                    const { data: existingReport, error: reportError } = await supabase
                        .from('monthly_reports')
                        .select('id')
                        .eq('vessel_id', vessel.id)
                        .eq('report_month', reportMonthStr)
                        .maybeSingle()

                    if (reportError) {
                        console.error('Error checking report status:', reportError)
                    }

                    if (existingReport) {
                        setMonthlyReportExists(true)
                    } else {
                        setMonthlyReportExists(false)
                    }
                } else {
                    setMonthlyReportExists(false)
                }
            }

            console.log('Starting file processing...')
            const data = await file.arrayBuffer()
            console.log('File buffer size:', data.byteLength)

            const workbook = XLSX.read(data, { type: 'array' })
            console.log('Workbook loaded, sheets:', workbook.SheetNames)

            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
            console.log('Parsed JSON data rows:', jsonData.length)

            if (jsonData.length < 2) {
                setError('The file appears to be empty or has no data rows')
                setIsProcessing(false)
                return
            }

            // Map columns to our expected structure
            // Expected columns: Nr (skip), unique_code, classification, nomenclature, brand, model, serial_number, part_number, date_manufactured, date_installed_issued, ics, par, quantity

            // Find header row to detect column positions
            let headerRowIndex = -1
            let columnMap: Record<string, number> = {}

            for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
                const row = jsonData[i]
                if (!row || row.length === 0) continue

                const firstCol = String(row[0] || '').trim().toLowerCase()
                if (firstCol === 'nr' || firstCol === 'no' || firstCol === 'number' || firstCol === '#') {
                    headerRowIndex = i
                    console.log('[DEBUG] Found header row at index:', i)
                    // Build column map from headers
                    row.forEach((header: any, index: number) => {
                        const headerName = String(header).trim().toLowerCase()
                        console.log(`[DEBUG] Column ${index}: "${headerName}"`)
                        if (headerName.includes('unique code') || headerName === 'unique_code' || headerName === 'uniquecode') columnMap.unique_code = index
                        else if (headerName.includes('classification') || headerName === 'class') columnMap.classification = index
                        else if (headerName.includes('nomenclature') || headerName === 'name' || headerName === 'item name' || headerName === 'description') columnMap.nomenclature = index
                        else if (headerName.includes('brand') || headerName.includes('manufacturer')) columnMap.brand = index
                        else if (headerName === 'model') columnMap.model = index
                        else if (headerName.includes('serial') || headerName === 'serial_number' || headerName === 'serialno') columnMap.serial_number = index
                        else if (headerName.includes('part') || headerName === 'part_number' || headerName === 'partno') columnMap.part_number = index
                        else if (headerName.includes('date manufactured') || headerName === 'date_manufactured' || headerName === 'manufactured date') columnMap.date_manufactured = index
                        else if (headerName.includes('date installed') || headerName.includes('date issued') || headerName === 'date_installed_issued' || headerName.includes('installed/issued')) columnMap.date_installed_issued = index
                        else if (headerName === 'ics' || headerName.includes('inventory custodian')) columnMap.ics = index
                        else if (headerName === 'par' || headerName.includes('property acknowledgement')) columnMap.par = index
                        else if (headerName === 'quantity' || headerName === 'qty' || headerName === 'count' || headerName === 'qty.' || headerName === 'balance on hand' || headerName === 'balance') columnMap.quantity = index
                        else if (headerName.includes('last pms') || headerName.includes('last_pms') || headerName.includes('date of last pms')) columnMap.date_last_pms = index
                        else if (headerName.includes('last repair') || headerName.includes('last_repair') || headerName.includes('date of last repair')) columnMap.date_last_repair = index
                        else if (headerName.includes('running hours') || headerName.includes('running_hours')) columnMap.running_hours = index
                        else if (headerName === 'remarks' || headerName === 'remark') columnMap.remarks = index
                        else if (headerName === 'status' || headerName === 'condition') columnMap.item_data_status = index
                    })
                    console.log('[DEBUG] Final columnMap:', columnMap)
                    break
                }
            }

            const extractNumber = (value: any): number | null => {
                if (value === null || value === undefined || value === '') {
                    console.log('[DEBUG] extractNumber: null/undefined/empty')
                    return null
                }
                if (typeof value === 'number') {
                    console.log('[DEBUG] extractNumber: number input', value)
                    return value
                }

                const str = String(value).trim()
                console.log('[DEBUG] extractNumber: string input', str)
                const match = str.match(/\d+/)
                if (match) {
                    const num = parseInt(match[0], 10)
                    console.log('[DEBUG] extractNumber: extracted', num)
                    return isNaN(num) ? null : num
                }

                console.log('[DEBUG] extractNumber: no number found')
                return null
            }

            const items: ImportItem[] = jsonData
                .filter((row, rowIndex) => {
                    // Skip header row
                    if (rowIndex === headerRowIndex) return false

                    // Skip empty rows
                    if (row.length === 0) return false

                    // Skip if first column is Nr (header row for column names)
                    const firstCol = row[0]?.toString().trim().toLowerCase()
                    if (firstCol === 'nr' || firstCol === 'no' || firstCol === 'number' || firstCol === '#') {
                        return false
                    }

                    const uniqueCode = columnMap.unique_code !== undefined
                        ? row[columnMap.unique_code]?.toString().trim()
                        : row[1]?.toString().trim()

                    // Skip rows without unique code
                    if (!uniqueCode) return false

                    // Skip header rows (check if it looks like a header)
                    const headerKeywords = ['unique code', 'classification', 'nomenclature', 'brand', 'serial', 'part']
                    const lowerCode = uniqueCode.toLowerCase()
                    if (headerKeywords.some(keyword => lowerCode.includes(keyword))) return false

                    // Skip category rows (single words or multi-word names without proper code format)
                    // Valid unique codes should contain hyphens or numbers
                    const isCategoryName = /^[A-Za-z\s]+$/.test(uniqueCode) && !uniqueCode.includes('-')
                    if (isCategoryName) {
                        return false
                    }

                    return true
                })
                .map((row) => {
                    try {
                        console.log('[DEBUG] Processing row:', row)
                        console.log('[DEBUG] columnMap.quantity:', columnMap.quantity)

                        // Check if this is an AMMUNITION row (different column structure)
                        // AMMUNITION rows have only 5 columns: Nr, Unique Code, Classification, Nomenclature, Quantity
                        const uniqueCode = row[1]?.toString().trim() || ''
                        const isAmmunition = uniqueCode.startsWith('AM')

                        console.log('[DEBUG] Is AMMUNITION row:', isAmmunition, 'uniqueCode:', uniqueCode)

                        let item: ImportItem

                        if (isAmmunition) {
                            // AMMUNITION structure: [Nr, Unique Code, Classification, Nomenclature, Quantity]
                            console.log('[DEBUG] Using AMMUNITION column mapping')
                            item = {
                                unique_code: row[1]?.toString().trim() || '',
                                classification: row[2]?.toString().trim() || '',
                                nomenclature: row[3]?.toString().trim() || '',
                                brand: '',
                                model: '',
                                serial_number: '',
                                part_number: '',
                                date_manufactured: '',
                                date_installed_issued: '',
                                ics: '',
                                par: '',
                                quantity: extractNumber(row[4])
                            }
                        } else {
                            // Standard equipment structure using columnMap
                            console.log('[DEBUG] Using standard column mapping')

                            item = {
                                unique_code: columnMap.unique_code !== undefined
                                    ? row[columnMap.unique_code]?.toString().trim() || ''
                                    : '',
                                classification: columnMap.classification !== undefined
                                    ? row[columnMap.classification]?.toString().trim() || ''
                                    : '',
                                nomenclature: columnMap.nomenclature !== undefined
                                    ? row[columnMap.nomenclature]?.toString().trim() || ''
                                    : '',
                                brand: columnMap.brand !== undefined
                                    ? row[columnMap.brand]?.toString().trim() || ''
                                    : '',
                                model: columnMap.model !== undefined
                                    ? row[columnMap.model]?.toString().trim() || ''
                                    : '',
                                serial_number: columnMap.serial_number !== undefined
                                    ? row[columnMap.serial_number]?.toString().trim() || ''
                                    : '',
                                part_number: columnMap.part_number !== undefined
                                    ? row[columnMap.part_number]?.toString().trim() || ''
                                    : '',
                                date_manufactured: columnMap.date_manufactured !== undefined
                                    ? formatDateToISO(row[columnMap.date_manufactured] || '') || ''
                                    : '',
                                date_installed_issued: columnMap.date_installed_issued !== undefined
                                    ? formatDateToISO(row[columnMap.date_installed_issued] || '') || ''
                                    : '',
                                ics: columnMap.ics !== undefined
                                    ? row[columnMap.ics]?.toString().trim() || ''
                                    : '',
                                par: columnMap.par !== undefined
                                    ? row[columnMap.par]?.toString().trim() || ''
                                    : '',
                                quantity: columnMap.quantity !== undefined
                                    ? extractNumber(row[columnMap.quantity])
                                    : null,
                                date_last_pms: columnMap.date_last_pms !== undefined
                                    ? formatDateToISO(row[columnMap.date_last_pms] || '') || undefined
                                    : undefined,
                                date_last_repair: columnMap.date_last_repair !== undefined
                                    ? formatDateToISO(row[columnMap.date_last_repair] || '') || undefined
                                    : undefined,
                                running_hours: columnMap.running_hours !== undefined
                                    ? extractNumber(row[columnMap.running_hours])
                                    : null,
                                remarks: columnMap.remarks !== undefined
                                    ? row[columnMap.remarks]?.toString().trim() || undefined
                                    : undefined,
                                item_data_status: columnMap.item_data_status !== undefined
                                    ? row[columnMap.item_data_status]?.toString().trim() || undefined
                                    : undefined,
                            }
                        }

                        console.log('[DEBUG] Parsed item:', item)
                        return item
                    } catch (rowError) {
                        console.error('Error processing row:', row, rowError)
                        return null
                    }
                })
                .filter((item): item is ImportItem => item !== null)

            console.log('Processed items count:', items.length)

            if (items.length === 0) {
                setError('No valid items found in the file')
                setIsProcessing(false)
                return
            }

            // Check for existing items in the database
            console.log('Checking for existing items...')
            const supabase = createClient()

            // If it's HQ inventory, we want all OLCF6 items to check for missed items
            // Otherwise just check the ones in the file
            let existingItemsQuery = supabase.from('items').select('*')

            if (isHqInventory) {
                existingItemsQuery = existingItemsQuery.ilike('unique_code', '%OLCF6%')
            } else {
                const uniqueCodes = items.map(item => item.unique_code)
                existingItemsQuery = existingItemsQuery.in('unique_code', uniqueCodes)
            }

            const { data: existingItems, error: fetchError } = await existingItemsQuery

            if (fetchError) {
                console.error('Error fetching existing items:', fetchError)
            }

            const existingItemsMap = new Map(existingItems?.map(item => [item.unique_code, item]) || [])
            console.log('Existing items count:', existingItemsMap.size)

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

            // Helper to compare if values are changed
            const hasFieldChanges = (excelItem: ImportItem, dbItem: any): boolean => {
                const fieldsToCompare = [
                    'classification',
                    'nomenclature',
                    'brand',
                    'model',
                    'serial_number',
                    'part_number',
                    'date_manufactured',
                    'date_installed_issued',
                    'ics',
                    'par',
                    'quantity'
                ] as const;

                return fieldsToCompare.some(field => {
                    let excelVal = excelItem[field];
                    let dbVal = dbItem[field];

                    if (field === 'quantity') {
                        const excelNum = excelVal === null || excelVal === undefined ? null : Number(excelVal);
                        const dbNum = dbVal === null || dbVal === undefined ? null : Number(dbVal);
                        return excelNum !== dbNum;
                    }

                    const excelStr = excelVal === null || excelVal === undefined ? '' : String(excelVal).trim();
                    const dbStr = dbVal === null || dbVal === undefined ? '' : String(dbVal).trim();

                    return excelStr !== dbStr;
                });
            };

            // Mark statuses for items from file
            const processedItems: ImportItem[] = items.map(item => {
                const isInternalDuplicate = counts.get(item.unique_code)! > 1
                const dbItem = existingItemsMap.get(item.unique_code)
                const exists = !!dbItem
                let status: 'new' | 'duplicate' | 'not_on_masterlist' | 'missed' | 'internal_duplicate' | 'overwrite'

                if (isInternalDuplicate) {
                    status = 'internal_duplicate'
                } else if (exists) {
                    if (!isMonthlyReport && hasFieldChanges(item, dbItem)) {
                        status = 'overwrite'
                    } else {
                        status = 'duplicate'
                    }
                } else {
                    status = isMonthlyReport ? 'not_on_masterlist' : 'new'
                }

                return { ...item, status, originalDbItem: dbItem }
            })

            // If monthly report, identify missed items (in DB but not in File)
            if (isMonthlyReport && existingItems) {
                const fileUniqueCodes = new Set(items.map(i => i.unique_code))
                const missedItems: ImportItem[] = existingItems
                    .filter(dbItem => !fileUniqueCodes.has(dbItem.unique_code))
                    .map(dbItem => ({
                        unique_code: dbItem.unique_code,
                        classification: dbItem.classification || '',
                        nomenclature: dbItem.nomenclature || '',
                        brand: dbItem.brand || '',
                        model: dbItem.model || '',
                        serial_number: dbItem.serial_number || '',
                        part_number: dbItem.part_number || '',
                        date_manufactured: dbItem.date_manufactured || '',
                        date_installed_issued: dbItem.date_installed_issued || '',
                        ics: dbItem.ics || '',
                        par: dbItem.par || '',
                        quantity: dbItem.quantity,
                        date_last_pms: dbItem.date_last_pms || undefined,
                        date_last_repair: dbItem.date_last_repair || undefined,
                        running_hours: dbItem.running_hours,
                        remarks: dbItem.remarks || undefined,
                        item_data_status: dbItem.status || undefined,
                        status: 'missed'
                    }))

                processedItems.push(...missedItems)
            }

            setParsedData(processedItems)
            console.log('File processing completed successfully')
        } catch (err) {
            console.error('File processing error:', err)
            if (err instanceof Error && err.message.includes('Maximum call stack')) {
                setError('File processing failed: Maximum call stack exceeded. The file may contain circular references or invalid data.')
            } else {
                setError('Failed to process the file. Please ensure it is a valid Excel file.')
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const executeImport = async (overwrite: boolean = false) => {
        if (parsedData.length === 0) return

        setIsImporting(true)
        setError(null)

        try {
            const supabase = createClient()
            const user = await getAuthUser()
            if (!user) throw new Error('Not authenticated')

            const token = await getValidAccessToken()
            if (!token) throw new Error('Not authenticated')

            // Map each item to its equipment_id based on unique code matching
            const itemsWithEquipmentId = parsedData.map(item => {
                let matchedEquipmentCode: string | null = null

                // If a specific equipment_id is provided, use it for all items
                if (equipmentId) {
                    return { ...item, equipment_id: equipmentId }
                }

                // Otherwise, match equipment by unique code prefix (same logic as preview)
                const sortedEquipmentCodes = Object.keys(equipments).sort((a, b) => b.length - a.length)

                for (const equipCode of sortedEquipmentCodes) {
                    if (item.unique_code.startsWith(equipCode)) {
                        matchedEquipmentCode = equipCode
                        break
                    }
                }

                // If no match found, try extracting prefix from item unique code
                if (!matchedEquipmentCode) {
                    const parts = item.unique_code.split('-')
                    if (parts.length >= 2) {
                        matchedEquipmentCode = parts.slice(0, -1).join('-')
                    }
                }

                const equipment = matchedEquipmentCode ? equipments[matchedEquipmentCode] : null

                if (!equipment) {
                    throw new Error(`No matching equipment found for unique code: ${item.unique_code}`)
                }

                return { ...item, equipment_id: equipment.id }
            })

            // If it's HQ Inventory Monthly Report, use the sync-hq-inventory function
            if (isHqInventory && isMonthlyReport) {
                // Prefer month/year parsed from filename; fall back to props if not available
                const reportMonth = (parsedFileInfo && parsedFileInfo.month !== undefined) ? parsedFileInfo.month - 1 : month
                const reportYear = (parsedFileInfo && parsedFileInfo.year !== undefined) ? parsedFileInfo.year : year

                if (reportMonth === undefined || reportYear === undefined) {
                    throw new Error('Month and Year are required for HQ Monthly Report synchronization')
                }

                const syncPayload = {
                    month: reportMonth, // sync-hq-inventory expects 0-indexed month
                    year: reportYear,
                    items: itemsWithEquipmentId
                        .filter(item => item.status !== 'missed' && item.status !== 'internal_duplicate')
                        .map(item => ({
                            ...item,
                            status: item.item_data_status || 'Serviceable' // Capture data status from file
                        }))
                }

                const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-hq-inventory`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(syncPayload)
                })

                if (!syncResponse.ok) {
                    const errorData = await syncResponse.json()
                    throw new Error(errorData.error || 'Failed to synchronize HQ inventory')
                }

                onImportComplete(parsedFileInfo)
                onClose()
                return
            }

            // Standard import logic for everything else
            // Remove status property before sending to edge function
            const itemsToImport = itemsWithEquipmentId
                .filter(item => {
                    if (overwrite) {
                        return item.status === 'new' || item.status === 'overwrite';
                    }
                    return item.status === 'new';
                })
                .map(({ status, ...item }) => item)

            console.log('Sending items to import. Count:', itemsToImport.length, 'Overwrite:', overwrite)

            if (itemsToImport.length === 0) {
                setError('No items to import/update. All items in the file already exist and are identical.')
                setIsImporting(false)
                return
            }

            const payload = {
                equipment_id: equipmentId,
                items: itemsToImport,
                overwrite
            }

            // Safe JSON stringify to detect circular references
            let body: string
            try {
                body = JSON.stringify(payload)
            } catch (stringifyError) {
                console.error('Failed to stringify payload - possible circular reference:', stringifyError)
                throw new Error('Invalid data format: circular reference detected')
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-items`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to import items')
            }

            if (overwrite) {
                setShowSuccessModal(true)
            } else {
                onImportComplete(parsedFileInfo)
                onClose()
            }
        } catch (err: any) {
            setError(err.message || 'Failed to import items')
        } finally {
            setIsImporting(false)
        }
    }

    const handleImport = async () => {
        if (isMonthlyReport && monthlyReportExists) {
            setShowMonthlyReportOverwriteConfirm(true)
        } else {
            const hasOverwrites = parsedData.some(item => item.status === 'overwrite')
            if (hasOverwrites) {
                setShowConfirmOverwriteModal(true)
            } else {
                await executeImport(false)
            }
        }
    }

    const handleReset = () => {
        setFile(null)
        setParsedData([])
        setError(null)
        setIsSuccess(false)
        setMonthlyReportExists(false)
        setShowMonthlyReportOverwriteConfirm(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const prefixBase = file ? extractFilenamePrefix(file.name) : ''
    const hasMismatchedUniqueCode = !!(file && parsedData.some(item =>
        item.status !== 'missed' &&
        item.unique_code &&
        !item.unique_code.toLowerCase().includes(prefixBase.toLowerCase())
    ))

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-surface max-w-4xl w-full shadow-popover border border-foreground/10 max-h-[90vh] overflow-hidden flex flex-col rounded-none">
                <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                    <div>
                        <h3 className="font-semibold text-[20px] text-foreground">{title || 'Update Masterlist'}</h3>
                        <p className="text-sm text-foreground-muted mt-1">
                            {subtitle || (equipmentName ? `Equipment: ${equipmentName}` : 'Auto-categorize by Unique Code')}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5 rounded-none">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-foreground/10 bg-foreground/5 p-2 gap-2 shrink-0">
                    <button
                        onClick={() => handleTabChange('import')}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-none ${activeTab === 'import' ? 'bg-[#000080] text-white shadow-card' : 'bg-[#E6E6FA] text-[#000033] hover:bg-[#E6E6FA]/80'}`}
                        type="button"
                    >
                        {isMonthlyReport ? 'Update Monthly Report' : 'Update Masterlist'}
                    </button>
                    <button
                        onClick={() => handleTabChange('verify')}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-none ${activeTab === 'verify' ? 'bg-[#000080] text-white shadow-card' : 'bg-[#E6E6FA] text-[#000033] hover:bg-[#E6E6FA]/80'}`}
                        type="button"
                    >
                        File Verification
                    </button>
                </div>

                <div className="p-3 overflow-y-auto flex-1">
                    {activeTab === 'import' && (
                        <>
                            {error && (
                                <div className="mb-4 flex items-center gap-2 text-sm text-error bg-error-bg p-3">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {!file ? (
                                <div className="border-2 border-dashed border-foreground/20 p-4 text-center hover:border-foreground/40 transition-colors">
                                    <div className="w-16 h-16 bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                                        <FileSpreadsheet className="w-8 h-8 text-foreground" />
                                    </div>
                                    <h4 className="text-[16px] font-semibold text-foreground mb-2">Upload Excel File</h4>
                                    <p className="text-sm text-foreground-muted mb-4">
                                        Upload an Excel file (.xlsx or .xls) containing the items to import.
                                    </p>
                                    {isHqInventory && isMonthlyReport && (
                                        <p className="text-xs text-secondary mb-4 font-medium">
                                            Filename must follow format: <span className="font-mono">SLUG-MMYYYY.xlsx</span> (e.g. HQ-052026.xlsx) — month and year are auto-detected from the filename.
                                        </p>
                                    )}
                                    <p className="text-xs text-foreground-muted mb-4">
                                        Expected columns: {isHqInventory ?
                                            'Unique Code, Classification, Nomenclature, Brand, Model, Serial Number, Part Number, Date Manufactured, Date Acquired' :
                                            'Unique Code, Classification, Nomenclature, Brand, Model, Serial Number, Part Number, Date Manufactured, Date Installed/Issued, ICS, PAR'}
                                    </p>
                                    {!equipmentId && !isMonthlyReport && !isHqInventory && (
                                        <p className="text-xs text-secondary mb-4 font-medium">
                                            Filename must follow format: <span className="font-mono">(Bow number)-masterlist.xlsx</span> (e.g. PS176-masterlist.xlsx)
                                        </p>
                                    )}
                                    {!equipmentId && !isMonthlyReport && (
                                        <p className="text-xs text-secondary mb-4 font-medium">
                                            Items will be auto-categorized by their unique codes
                                        </p>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label
                                        htmlFor="file-upload"
                                        className="inline-flex items-center gap-2 bg-accent text-white px-6 py-2.5 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Select File
                                    </label>
                                </div>
                            ) : !parsedData.length ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-foreground/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                                                <FileSpreadsheet className="w-5 h-5 text-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{file?.name}</p>
                                                <div className="flex gap-2 text-xs">
                                                    <span className="text-foreground-muted">{file ? (file.size / 1024).toFixed(2) : '0'} KB</span>
                                                    {parsedFileInfo && parsedFileInfo.month_name && (
                                                        <span className="text-secondary font-bold uppercase tracking-wider">
                                                            • Detected Period: {parsedFileInfo.month_name} {parsedFileInfo.year}
                                                        </span>
                                                    )}
                                                    {parsedFileInfo && parsedFileInfo.bow_number && (
                                                        <span className="text-secondary font-bold uppercase tracking-wider">
                                                            • Detected Bow: {parsedFileInfo.bow_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleReset}
                                            className="text-foreground-muted hover:text-error transition-colors p-1 hover:bg-error-bg"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleProcessFile}
                                        disabled={isProcessing}
                                        className="w-fit mx-auto block bg-accent text-white px-6 py-3 hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                    >
                                        {isProcessing ? 'Processing...' : 'Import & Preview'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-foreground-muted">
                                                <Check className="w-4 h-4 text-secondary" />
                                                {isMonthlyReport
                                                    ? `${parsedData.filter(item => item.status === 'duplicate').length} synced items`
                                                    : `${parsedData.filter(item => item.status === 'new').length} items ready to import`}
                                            </div>
                                            {parsedData.some(item => item.status === 'internal_duplicate') && (
                                                <div className="flex items-center gap-2 text-foreground-muted">
                                                    <AlertCircle className="w-4 h-4 text-error" />
                                                    {parsedData.filter(item => item.status === 'internal_duplicate').length} duplicate unique codes
                                                </div>
                                            )}
                                            {parsedData.some(item => item.status === 'duplicate') && !isMonthlyReport && (
                                                <div className="flex items-center gap-2 text-foreground-muted">
                                                    <AlertCircle className="w-4 h-4 text-error" />
                                                    {parsedData.filter(item => item.status === 'duplicate').length} items exist and will be skipped
                                                </div>
                                            )}
                                            {parsedData.some(item => item.status === 'not_on_masterlist') && (
                                                <div className="flex items-center gap-2 text-foreground-muted">
                                                    <AlertCircle className="w-4 h-4 text-error" />
                                                    {parsedData.filter(item => item.status === 'not_on_masterlist').length} not on masterlist
                                                </div>
                                            )}
                                            {parsedData.some(item => item.status === 'missed') && (
                                                <div className="flex items-center gap-2 text-foreground-muted">
                                                    <AlertCircle className="w-4 h-4 text-error" />
                                                    {parsedData.filter(item => item.status === 'missed').length} missed from masterlist
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleReset}
                                            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
                                        >
                                            Upload different file
                                        </button>
                                    </div>

                                    {/* Group items by equipment */}
                                    {(() => {
                                        const groupedItems = parsedData.reduce((groups, item) => {
                                            let matchedEquipmentCode: string | null = null
                                            const sortedEquipmentCodes = Object.keys(equipments).sort((a, b) => b.length - a.length)

                                            for (const equipCode of sortedEquipmentCodes) {
                                                if (item.unique_code.startsWith(equipCode)) {
                                                    matchedEquipmentCode = equipCode
                                                    break
                                                }
                                            }

                                            if (!matchedEquipmentCode) {
                                                const parts = item.unique_code.split('-')
                                                if (parts.length >= 2) {
                                                    matchedEquipmentCode = parts.slice(0, -1).join('-')
                                                }
                                            }

                                            if (matchedEquipmentCode) {
                                                if (!groups[matchedEquipmentCode]) {
                                                    groups[matchedEquipmentCode] = []
                                                }
                                                groups[matchedEquipmentCode].push(item)
                                            }

                                            return groups
                                        }, {} as Record<string, ImportItem[]>)

                                        const equipmentCodes = Object.keys(groupedItems).sort()

                                        return equipmentCodes.map((equipmentCode) => {
                                            const equipment = equipments[equipmentCode]
                                            const equipmentName = equipment?.name || equipmentCode
                                            const equipmentType = equipment?.equipment_type
                                            const isAmmunitions = equipmentType === 'ammunitions'

                                            return (
                                                <div key={equipmentCode} className="border border-foreground/10 overflow-hidden">
                                                    <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{equipmentName}</h4>
                                                        <p className="text-xs text-foreground-muted">{equipmentCode} • {groupedItems[equipmentCode].length} items {equipmentType && `(${equipmentType.toUpperCase()})`}</p>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full min-w-[1200px]">
                                                            <thead className="bg-foreground/5">
                                                                <tr>
                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Preview Status</th>
                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Unique Code</th>
                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Classification</th>
                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Nomenclature</th>
                                                                    {!isAmmunitions && (
                                                                        <>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Brand</th>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Model</th>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Serial Number</th>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Part Number</th>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date Manufactured</th>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">{isHqInventory ? 'Date Acquired' : 'Date Installed/Issued'}</th>
                                                                            {(isHqInventory && isMonthlyReport) && (
                                                                                <>
                                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date of Last PMS</th>
                                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date of Last Repair</th>
                                                                                    {equipmentName.toUpperCase().includes('NAVIGATIONAL') && (
                                                                                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Running Hours</th>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {(!isHqInventory || isMonthlyReport) && (
                                                                                <>
                                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">ICS</th>
                                                                                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">PAR</th>
                                                                                </>
                                                                            )}
                                                                            {(isHqInventory && isMonthlyReport) && (
                                                                                <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Status</th>
                                                                            )}
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Remarks</th>
                                                                        </>
                                                                    )}
                                                                    {isAmmunitions && (
                                                                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Balance on Hand</th>
                                                                    )}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-foreground/10">
                                                                {groupedItems[equipmentCode].map((item, index) => {
                                                                    const isMismatched = item.status !== 'missed' && item.unique_code && !item.unique_code.toLowerCase().includes(prefixBase.toLowerCase())

                                                                    const getCellClassName = (fieldName: string, excelValue: any, isQuantity = false) => {
                                                                        const baseClass = "px-3 py-3 text-sm text-foreground whitespace-nowrap";
                                                                        let classes = baseClass;

                                                                        if (item.status === 'overwrite') {
                                                                            classes += " border-b-2 border-orange-500/60";
                                                                        }

                                                                        if (item.status !== 'overwrite' || !item.originalDbItem) {
                                                                            return classes;
                                                                        }

                                                                        const dbValue = item.originalDbItem[fieldName];
                                                                        let isDifferent = false;

                                                                        if (isQuantity) {
                                                                            const excelNum = excelValue === null || excelValue === undefined ? null : Number(excelValue);
                                                                            const dbNum = dbValue === null || dbValue === undefined ? null : Number(dbValue);
                                                                            isDifferent = excelNum !== dbNum;
                                                                        } else {
                                                                            const excelStr = excelValue === null || excelValue === undefined ? '' : String(excelValue).trim();
                                                                            const dbStr = dbValue === null || dbValue === undefined ? '' : String(dbValue).trim();
                                                                            isDifferent = excelStr !== dbStr;
                                                                        }

                                                                        if (isDifferent) {
                                                                            classes += " bg-orange-500/25 text-[#000033] font-bold border-x border-orange-500/30";
                                                                        }

                                                                        return classes;
                                                                    }

                                                                    const rowBorderClass = item.status === 'overwrite' ? "border-b-2 border-orange-500/60" : "";

                                                                    return (
                                                                        <tr key={index} className={`hover:bg-foreground/3 ${isMismatched ? 'bg-error-bg/25 border-l-4 border-error' : item.status === 'overwrite' ? 'bg-orange-500/15 border-l-4 border-orange-500' : item.status === 'duplicate' || item.status === 'internal_duplicate' ? 'bg-error-bg/30' : item.status === 'missed' ? 'bg-error-bg/10' : ''}`}>
                                                                            <td className={`px-3 py-3 text-sm whitespace-nowrap ${rowBorderClass}`}>
                                                                                {isMismatched ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold uppercase bg-error text-white">
                                                                                        Mismatched
                                                                                    </span>
                                                                                ) : item.status === 'overwrite' ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold uppercase bg-orange-500 text-white">
                                                                                        Overwrite
                                                                                    </span>
                                                                                ) : item.status === 'duplicate' || item.status === 'internal_duplicate' ? (
                                                                                    isMonthlyReport ? (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-secondary/20 text-foreground">
                                                                                            Synced
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-error-bg text-error">
                                                                                            {item.status === 'internal_duplicate' ? 'Duplicate Unique Code' : 'Duplicate'}
                                                                                        </span>
                                                                                    )
                                                                                ) : item.status === 'new' ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-secondary/20 text-foreground">
                                                                                        New
                                                                                    </span>
                                                                                ) : item.status === 'not_on_masterlist' ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-error-bg text-error">
                                                                                        Not on Masterlist
                                                                                    </span>
                                                                                ) : item.status === 'missed' ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-error-bg text-error">
                                                                                        Missed Item
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-secondary/20 text-foreground">
                                                                                        -
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td className={`px-3 py-3 text-sm text-foreground font-medium whitespace-nowrap ${rowBorderClass}`}>{item.unique_code || '-'}</td>
                                                                            <td className={getCellClassName('classification', item.classification)}>{item.classification || '-'}</td>
                                                                            <td className={getCellClassName('nomenclature', item.nomenclature)}>{item.nomenclature || '-'}</td>
                                                                            {!isAmmunitions && (
                                                                                <>
                                                                                    <td className={getCellClassName('brand', item.brand)}>{item.brand || '-'}</td>
                                                                                    <td className={getCellClassName('model', item.model)}>{item.model || '-'}</td>
                                                                                    <td className={getCellClassName('serial_number', item.serial_number)}>{item.serial_number || '-'}</td>
                                                                                    <td className={getCellClassName('part_number', item.part_number)}>{item.part_number || '-'}</td>
                                                                                    <td className={getCellClassName('date_manufactured', item.date_manufactured)}>{item.date_manufactured || '-'}</td>
                                                                                    <td className={getCellClassName('date_installed_issued', item.date_installed_issued)}>{item.date_installed_issued || '-'}</td>
                                                                                    {(isHqInventory && isMonthlyReport) && (
                                                                                        <>
                                                                                            <td className={`px-3 py-3 text-sm text-foreground whitespace-nowrap ${rowBorderClass}`}>{item.date_last_pms || '-'}</td>
                                                                                            <td className={`px-3 py-3 text-sm text-foreground whitespace-nowrap ${rowBorderClass}`}>{item.date_last_repair || '-'}</td>
                                                                                            {equipmentName.toUpperCase().includes('NAVIGATIONAL') && (
                                                                                                <td className={`px-3 py-3 text-sm text-foreground whitespace-nowrap ${rowBorderClass}`}>{item.running_hours ?? '-'}</td>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                    {(!isHqInventory || isMonthlyReport) && (
                                                                                        <>
                                                                                            <td className={getCellClassName('ics', item.ics)}>{item.ics || '-'}</td>
                                                                                            <td className={getCellClassName('par', item.par)}>{item.par || '-'}</td>
                                                                                        </>
                                                                                    )}
                                                                                    {(isHqInventory && isMonthlyReport) && (
                                                                                        <td className={`px-3 py-3 text-sm text-foreground whitespace-nowrap ${rowBorderClass}`}>{item.item_data_status || '-'}</td>
                                                                                    )}
                                                                                    <td className={`px-3 py-3 text-[11px] text-foreground-muted italic max-w-[200px] truncate ${rowBorderClass}`}>{item.remarks || '-'}</td>
                                                                                </>
                                                                            )}
                                                                            {isAmmunitions && (
                                                                                <td className={getCellClassName('quantity', item.quantity, true)}>{item.quantity ?? '-'}</td>
                                                                            )}
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    })()}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'verify' && (
                        <div className="space-y-4 text-foreground">
                            {verificationError && (
                                <div className="mb-4 flex items-center gap-2 text-sm text-error bg-error-bg p-3">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {verificationError}
                                </div>
                            )}

                            {!verifyFile ? (
                                <div className="border-2 border-dashed border-foreground/20 p-4 text-center hover:border-foreground/40 transition-colors">
                                    <div className="w-16 h-16 bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                                        <FileSpreadsheet className="w-8 h-8 text-foreground" />
                                    </div>
                                    <h4 className="text-[16px] font-semibold text-foreground mb-2">
                                        {isMonthlyReport ? 'Upload Monthly Report File to Verify' : 'Upload Masterlist File to Verify'}
                                    </h4>
                                    <p className="text-sm text-foreground-muted mb-4">
                                        Upload an Excel file (.xlsx or .xls) to verify its contents against the filename.
                                    </p>
                                    <p className="text-xs text-secondary mb-4 font-medium">
                                        {isMonthlyReport ? (
                                            <>
                                                Filename must follow format: <span className="font-mono">SLUG-MMYYYY.xlsx</span> (e.g. <span className="underline">HQ-052026.xlsx</span>) — month and year are auto-detected from the filename.
                                            </>
                                        ) : (
                                            <>
                                                Filename must follow format: <span className="font-mono">(Bow number)-masterlist.xlsx</span> (e.g. <span className="underline">PS176-masterlist.xlsx</span>) to verify unique codes.
                                            </>
                                        )}
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={(e) => {
                                            const selectedFile = e.target.files?.[0]
                                            if (selectedFile) {
                                                const validTypes = [
                                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                                    'application/vnd.ms-excel'
                                                ]
                                                if (!validTypes.includes(selectedFile.type)) {
                                                    setVerificationError('Please upload a valid Excel file (.xlsx or .xls)')
                                                    return
                                                }
                                                // Filename validation for Verification
                                                if (isMonthlyReport) {
                                                    const info = parseFilenameInfo(selectedFile.name)
                                                    if (!info || !info.month) {
                                                        setVerificationError('Invalid filename format. Must be SLUG-MMYYYY.xlsx (e.g. HQ-052026.xlsx)')
                                                        return
                                                    }
                                                } else {
                                                    // For masterlist verification
                                                    if (!isHqInventory) {
                                                        const info = parseFilenameInfo(selectedFile.name)
                                                        if (!info || !info.isMasterlist) {
                                                            setVerificationError('Invalid filename format. Must be (Bow number)-masterlist.xlsx (e.g. PS176-masterlist.xlsx)')
                                                            return
                                                        }
                                                    } else {
                                                        const info = parseFilenameInfo(selectedFile.name)
                                                        if (!info || !info.isMasterlist || info.bow_number?.toUpperCase() !== 'OLCF6') {
                                                            setVerificationError('Invalid filename format. Should only accept OLCF6-masterlist.xlsx')
                                                            return
                                                        }
                                                    }
                                                }
                                                setVerifyFile(selectedFile)
                                                setVerificationError(null)
                                                setVerifiedData([])
                                            }
                                        }}
                                        className="hidden"
                                        id="verify-file-upload"
                                    />
                                    <label
                                        htmlFor="verify-file-upload"
                                        className="inline-flex items-center gap-2 bg-accent text-white px-6 py-2.5 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card cursor-pointer rounded-none"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Select File to Verify
                                    </label>
                                </div>
                            ) : verifiedData.length === 0 ? (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="flex items-center justify-between p-4 bg-foreground/5 border border-foreground/10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                                                <FileSpreadsheet className="w-5 h-5 text-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{verifyFile?.name}</p>
                                                <p className="text-xs text-foreground-muted">{(verifyFile.size / 1024).toFixed(2)} KB</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setVerifyFile(null)
                                                setVerifiedData([])
                                                setVerificationError(null)
                                            }}
                                            className="text-foreground-muted hover:text-error transition-colors p-1 hover:bg-error-bg"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleVerifyFilter}
                                        disabled={isVerifying}
                                        className="w-fit mx-auto block bg-accent text-white px-6 py-3 hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card rounded-none"
                                    >
                                        {isVerifying ? 'Verifying...' : 'Verify File'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-fadeIn text-foreground">
                                    {/* Verification Header Alert */}
                                    {verifiedData.every(item => item.isMatched && !item.isDuplicate) ? (
                                        <div className="bg-emerald-950/20 border border-emerald-500 p-4 text-emerald-300">
                                            <div className="flex items-center gap-3">
                                                <Check className="w-6 h-6 text-emerald-400 shrink-0" />
                                                <div>
                                                    <h4 className="font-bold uppercase tracking-wider text-sm text-emerald-400">Verification Successful</h4>
                                                    <p className="text-xs mt-1 text-emerald-200">
                                                        All {verifiedData.length} items in the file match the reference {isMonthlyReport ? 'prefix' : 'bow number'} <span className="font-mono underline font-bold uppercase">{verifiedPrefix}</span>.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-error-bg/30 border border-error p-4 text-error">
                                            <div className="flex items-center gap-3">
                                                <AlertCircle className="w-6 h-6 text-error shrink-0" />
                                                <div>
                                                    <h4 className="font-bold uppercase tracking-wider text-sm text-error">Discrepancies / Mismatches Detected</h4>
                                                    <p className="text-xs mt-1 text-foreground">
                                                        {verifiedData.filter(item => !item.isMatched || item.isDuplicate).length} item(s) have problems. Check for incorrect prefix or duplicity below.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* All rows checklist */}
                                    <div className="border border-foreground/10 overflow-hidden">
                                        <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10 flex justify-between items-center text-foreground font-semibold">
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-widest">Verification Ledger</h4>
                                                <p className="text-xs text-foreground-muted mt-0.5">Filename Prefix: "{verifiedPrefix}"</p>
                                            </div>
                                            <span className="text-xs font-bold text-foreground bg-foreground/10 px-2 py-1">
                                                {verifiedData.length} Total Checked
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1200px] border-collapse">
                                                <thead className="bg-[#E6E6FA] text-[#000033] sticky top-0 z-10 border-b border-foreground/10">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Unique Code</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Classification</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Nomenclature</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Brand</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Model</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Serial Number</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Part Number</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date Manufactured</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date Issued</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">ICS</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">PAR</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-foreground/10 text-foreground">
                                                    {verifiedData.map((item, idx) => (
                                                        <tr key={idx} className={`hover:bg-foreground/3 text-foreground ${(!item.isMatched || item.isDuplicate) ? 'bg-error-bg/10' : ''}`}>
                                                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                                                                {item.isMatched && !item.isDuplicate ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-[#E6E6FA] text-[#000080]">
                                                                        [ MATCHED ]
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-error-bg text-error border border-error/30">
                                                                        [ MISMATCHED ]
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className={`px-3 py-2 text-xs font-mono font-medium ${(item.isMatched && !item.isDuplicate) ? 'text-foreground' : 'text-error font-bold'}`}>{item.unique_code}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground max-w-[200px] truncate">{item.nomenclature || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_manufactured) || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'import' && parsedData.length > 0 && (
                    <div className="p-3 border-t border-foreground/10 flex flex-col gap-2">
                        {isMonthlyReport && monthlyReportExists && (
                            <div className="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-widest bg-orange-500/10 p-2 mb-1 border border-orange-500/20">
                                <AlertCircle className="w-4 h-4" />
                                A monthly report already exists for this period. Importing will overwrite and replace the details.
                            </div>
                        )}
                        {(isMonthlyReport && parsedData.some(item => item.status === 'not_on_masterlist' || item.status === 'missed')) ||
                            parsedData.some(item => item.status === 'internal_duplicate') ||
                            hasMismatchedUniqueCode ? (
                            <div className="flex items-center gap-2 text-error text-xs font-bold uppercase tracking-widest bg-error-bg/10 p-2 mb-1">
                                <AlertCircle className="w-4 h-4" />
                                {parsedData.some(item => item.status === 'internal_duplicate')
                                    ? 'Import blocked: Duplicate unique codes found in file'
                                    : hasMismatchedUniqueCode
                                        ? `Import blocked: Unique codes must match the filename reference '${prefixBase}'`
                                        : 'Import blocked: Resolve discrepancies before synchronization'}
                            </div>
                        ) : null}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={isImporting}
                                className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={
                                    isImporting ||
                                    (isMonthlyReport && parsedData.some(item => item.status === 'not_on_masterlist' || item.status === 'missed')) ||
                                    parsedData.some(item => item.status === 'internal_duplicate') ||
                                    hasMismatchedUniqueCode
                                }
                                className="px-6 py-2.5 bg-accent text-white hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                            >
                                {isImporting
                                    ? 'Importing...'
                                    : (parsedData.some(item => item.status === 'overwrite') || (isMonthlyReport && monthlyReportExists))
                                        ? 'Overwrite'
                                        : 'Confirm Import'
                                }
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'verify' && (
                    <div className="p-3 border-t border-foreground/10 flex justify-end gap-3 shrink-0">
                        {verifyFile && verifiedData.length > 0 && (
                            <button
                                onClick={() => {
                                    setVerifyFile(null)
                                    setVerifiedData([])
                                    setVerificationError(null)
                                    setVerifiedPrefix(null)
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = ''
                                    }
                                }}
                                className="px-6 py-2.5 bg-[#E6E6FA] text-[#000033] hover:bg-[#E6E6FA]/80 transition-colors text-xs font-bold uppercase tracking-widest shadow-card rounded-none"
                            >
                                Verify Another File
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium rounded-none"
                        >
                            Close
                        </button>
                    </div>
                )}
                {showConfirmOverwriteModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
                        <div className="bg-[#FFFFFF] max-w-md w-full border border-[#000080] p-6 rounded-none flex flex-col gap-4 shadow-[#000033]/20 shadow-lg text-left">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-lg text-[#000033] uppercase tracking-wider">Confirm Overwrite</h4>
                                    <p className="text-sm text-foreground-muted mt-2">
                                        Are you sure you want to overwrite and update the existing masterlist entries with the changed values from the imported file? This action will replace the specifications of matching articles.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => setShowConfirmOverwriteModal(false)}
                                    className="px-4 py-2 border border-[#000080] bg-[#E6E6FA] text-[#000033] hover:bg-[#E6E6FA]/80 text-xs font-bold uppercase transition-colors rounded-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowConfirmOverwriteModal(false)
                                        await executeImport(true)
                                    }}
                                    className="px-5 py-2 bg-[#000080] text-[#FFFFFF] hover:bg-[#000080]/90 text-xs font-bold uppercase transition-colors rounded-none"
                                >
                                    Overwrite
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showMonthlyReportOverwriteConfirm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
                        <div className="bg-[#FFFFFF] max-w-md w-full border border-[#000080] p-6 rounded-none flex flex-col gap-4 shadow-[#000033]/20 shadow-lg text-left">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-lg text-[#000033] uppercase tracking-wider">Confirm Overwrite</h4>
                                    <p className="text-sm text-foreground-muted mt-2">
                                        Are you sure you want to overwrite and update the existing monthly report with the values from the imported file? This action will replace the details for this period.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    onClick={() => setShowMonthlyReportOverwriteConfirm(false)}
                                    className="px-4 py-2 border border-[#000080] bg-[#E6E6FA] text-[#000033] hover:bg-[#E6E6FA]/80 text-xs font-bold uppercase transition-colors rounded-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowMonthlyReportOverwriteConfirm(false)
                                        await executeImport(true)
                                    }}
                                    className="px-5 py-2 bg-[#000080] text-[#FFFFFF] hover:bg-[#000080]/90 text-xs font-bold uppercase transition-colors rounded-none"
                                >
                                    Overwrite
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSuccessModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
                        <div className="bg-[#FFFFFF] max-w-md w-full border border-[#000080] p-6 rounded-none flex flex-col gap-4 shadow-[#000033]/20 shadow-lg text-left">
                            <div className="flex items-start gap-3">
                                <Check className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-lg text-[#000033] uppercase tracking-wider">Masterlist Updated</h4>
                                    <p className="text-sm text-foreground-muted mt-2">
                                        The Masterlist has been successfully overwritten and updated with the new details.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false)
                                        onImportComplete(parsedFileInfo)
                                        onClose()
                                    }}
                                    className="px-6 py-2 bg-[#000080] text-[#FFFFFF] hover:bg-[#000080]/90 text-xs font-bold uppercase transition-colors rounded-none"
                                >
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    )
}
