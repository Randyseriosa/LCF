'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser } from '@/lib/auth'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'

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
    isDuplicate?: boolean
}

interface ImportItemsModalProps {
    isOpen: boolean
    onClose: () => void
    equipmentId?: string
    equipmentName?: string
    equipmentUniqueCode?: string
    onImportComplete: () => void
    isHqInventory?: boolean
}

export function ImportItemsModal({
    isOpen,
    onClose,
    equipmentId,
    equipmentName,
    equipmentUniqueCode,
    onImportComplete,
    isHqInventory
}: ImportItemsModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<ImportItem[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [equipments, setEquipments] = useState<Record<string, { id: string; name: string; equipment_type: string | null }>>({})
    const fileInputRef = useRef<HTMLInputElement>(null)

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
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

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
                        else if (headerName.includes('date installed') || headerName.includes('date issued') || headerName.includes('date acquired') || headerName === 'date_installed_issued' || headerName.includes('installed/issued')) columnMap.date_installed_issued = index
                        else if (headerName === 'ics' || headerName.includes('inventory custodian')) columnMap.ics = index
                        else if (headerName === 'par' || headerName.includes('property acknowledgement')) columnMap.par = index
                        else if (headerName === 'quantity' || headerName === 'qty' || headerName === 'count' || headerName === 'qty.') columnMap.quantity = index
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
                            const quantityValue = columnMap.quantity !== undefined ? row[columnMap.quantity] : undefined
                            console.log('[DEBUG] Raw quantity value from row:', quantityValue, 'at index', columnMap.quantity)

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
                                    ? formatDateToDDMMYYYY(row[columnMap.date_manufactured] || '') || ''
                                    : '',
                                date_installed_issued: columnMap.date_installed_issued !== undefined
                                    ? formatDateToDDMMYYYY(row[columnMap.date_installed_issued] || '') || ''
                                    : '',
                                ics: columnMap.ics !== undefined
                                    ? row[columnMap.ics]?.toString().trim() || ''
                                    : '',
                                par: columnMap.par !== undefined
                                    ? row[columnMap.par]?.toString().trim() || ''
                                    : '',
                                quantity: columnMap.quantity !== undefined
                                    ? extractNumber(row[columnMap.quantity])
                                    : null
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
            const uniqueCodes = items.map(item => item.unique_code)
            const { data: existingItems, error: fetchError } = await supabase
                .from('items')
                .select('unique_code')
                .in('unique_code', uniqueCodes)

            if (fetchError) {
                console.error('Error fetching existing items:', fetchError)
            }

            const existingUniqueCodes = new Set(existingItems?.map(item => item.unique_code) || [])
            console.log('Existing items count:', existingUniqueCodes.size)

            // Mark duplicates
            const itemsWithDuplicateStatus = items.map(item => ({
                ...item,
                isDuplicate: existingUniqueCodes.has(item.unique_code)
            }))

            setParsedData(itemsWithDuplicateStatus)
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

    const handleImport = async () => {
        if (parsedData.length === 0) return

        setIsImporting(true)
        setError(null)

        try {
            const supabase = createClient()
            const user = await getAuthUser()
            if (!user) throw new Error('Not authenticated')

            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
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

            // Remove isDuplicate property before sending to edge function
            const itemsToImport = itemsWithEquipmentId.map(({ isDuplicate, ...item }) => item)

            console.log('Sending items to import:', itemsToImport.length)

            const payload = {
                equipment_id: equipmentId,
                items: itemsToImport
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

            onImportComplete()
            onClose()
        } catch (err: any) {
            setError(err.message || 'Failed to import items')
        } finally {
            setIsImporting(false)
        }
    }

    const handleReset = () => {
        setFile(null)
        setParsedData([])
        setError(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-surface max-w-4xl w-full shadow-popover border border-foreground/10 max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                    <div>
                        <h3 className="font-semibold text-[20px] text-foreground">Import Items</h3>
                        <p className="text-sm text-foreground-muted mt-1">
                            {equipmentName ? `Equipment: ${equipmentName}` : 'Auto-categorize by Unique Code'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-3 overflow-y-auto flex-1">
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
                            <p className="text-xs text-foreground-muted mb-4">
                                Expected columns: {isHqInventory ?
                                    'Unique Code, Classification, Nomenclature, Brand, Model, Serial Number, Part Number, Date Manufactured, Date Acquired' :
                                    'Unique Code, Classification, Nomenclature, Brand, Model, Serial Number, Part Number, Date Manufactured, Date Installed/Issued, ICS, PAR'}
                            </p>
                            {!equipmentId && (
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
                                        <p className="text-sm font-medium text-foreground">{file.name}</p>
                                        <p className="text-xs text-foreground-muted">{(file.size / 1024).toFixed(2)} KB</p>
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
                                        {parsedData.length} items ready to import
                                    </div>
                                    {parsedData.some(item => item.isDuplicate) && (
                                        <div className="flex items-center gap-2 text-foreground-muted">
                                            <AlertCircle className="w-4 h-4 text-error" />
                                            {parsedData.filter(item => item.isDuplicate).length} duplicates will be skipped
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
                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Status</th>
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
                                                                    {!isHqInventory && (
                                                                        <>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">ICS</th>
                                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">PAR</th>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                            {isAmmunitions && !isHqInventory && (
                                                                <th className="px-3 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Quantity</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-foreground/10">
                                                        {groupedItems[equipmentCode].map((item, index) => (
                                                            <tr key={index} className={`hover:bg-foreground/3 ${item.isDuplicate ? 'bg-error-bg/30' : ''}`}>
                                                                <td className="px-3 py-3 text-sm whitespace-nowrap">
                                                                    {item.isDuplicate ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-error-bg text-error">
                                                                            Duplicate
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-secondary/20 text-foreground">
                                                                            New
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 text-sm text-foreground font-medium whitespace-nowrap">{item.unique_code || '-'}</td>
                                                                <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                                                <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                                                                {!isAmmunitions && (
                                                                    <>
                                                                        <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                                                        <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                                                        <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                                                        <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                                                        <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.date_manufactured || '-'}</td>
                                                                        <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.date_installed_issued || '-'}</td>
                                                                        {!isHqInventory && (
                                                                            <>
                                                                                <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                                                                <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {isAmmunitions && !isHqInventory && (
                                                                    <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{item.quantity ?? '-'}</td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>
                    )}
                </div>

                {parsedData.length > 0 && (
                    <div className="p-3 border-t border-foreground/10 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            disabled={isImporting}
                            className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={isImporting}
                            className="px-6 py-2.5 bg-accent text-white hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                        >
                            {isImporting ? 'Importing...' : 'Confirm Import'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
