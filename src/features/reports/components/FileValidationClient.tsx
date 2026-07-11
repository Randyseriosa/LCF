'use client'

import React, { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Check, AlertCircle, XCircle, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'

interface ValidatedItem {
    unique_code: string
    section: string
    classification: string
    nomenclature: string
    brand: string
    model: string
    serial_number: string
    part_number: string
    quantity: number | null
    previous_report?: number | null
    expended?: number | null
    replenished?: number | null
    balance_on_hand?: number | null
    date_manufactured?: string | Date | number | null
    date_installed_issued?: string | Date | number | null
    date_last_pms?: string | Date | number | null
    date_last_repair?: string | Date | number | null
    running_hours?: string | null
    status?: string
    remarks?: string
    ics?: string
    par?: string
    isMatched: boolean
    isDuplicate: boolean
    rowNum: number
}

interface ParsedFileInfo {
    bow_number: string
    month: number
    year: number
    month_name: string
}

export function FileValidationClient() {
    const [file, setFile] = useState<File | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [verificationError, setVerificationError] = useState<string | null>(null)
    const [verifiedPrefix, setVerifiedPrefix] = useState<string | null>(null)
    const [fileInfo, setFileInfo] = useState<ParsedFileInfo | null>(null)
    const [verifiedData, setVerifiedData] = useState<ValidatedItem[]>([])
    const [vesselExists, setVesselExists] = useState<boolean | null>(null)
    const [checkingVessel, setCheckingVessel] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const parseFilename = (filename: string): ParsedFileInfo | null => {
        const regex = /^([A-Z0-9-]+)-(\d{2})(\d{4})\.(xlsx|xls)$/i
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

    const checkVesselExistence = async (bowNumber: string) => {
        setCheckingVessel(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('vessels')
                .select('id')
                .eq('bow_number', bowNumber.toUpperCase())
                .maybeSingle()

            if (error) throw error
            setVesselExists(!!data)
        } catch (err) {
            console.error('Error checking vessel registration:', err)
            setVesselExists(null)
        } finally {
            setCheckingVessel(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

            const info = parseFilename(selectedFile.name)
            if (!info) {
                setVerificationError('Invalid filename format. Expected format: BowNumber-MMYYYY.xlsx (e.g. LCF01-072026.xlsx)')
                setFile(null)
                setFileInfo(null)
                return
            }

            setFile(selectedFile)
            setFileInfo(info)
            setVerifiedPrefix(info.bow_number)
            setVerificationError(null)
            setVerifiedData([])
            setVesselExists(null)
            checkVesselExistence(info.bow_number)
        }
    }

    const extractNumber = (value: any): number | null => {
        if (value === null || value === undefined || value === '') return null
        if (typeof value === 'number') return value

        const str = String(value).trim()
        const match = str.match(/\d+/)
        if (match) {
            const num = parseInt(match[0], 10)
            return isNaN(num) ? null : num
        }
        return null
    }

    const handleVerify = async () => {
        if (!file || !fileInfo) return

        setIsVerifying(true)
        setVerificationError(null)
        setVerifiedData([])

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            if (jsonData.length < 2) {
                setVerificationError('The file appears to be empty or has no data rows')
                setIsVerifying(false)
                return
            }

            const fieldMappings: Record<string, string[]> = {
                unique_code: ['unique code', 'unique_code', 'code', 'uniquecode'],
                classification: ['classification', 'class'],
                nomenclature: ['nomenclature', 'name', 'item name', 'description'],
                brand: ['brand', 'manufacturer'],
                model: ['model'],
                serial_number: ['serial number', 'serial_number', 'serial', 'serialno'],
                part_number: ['part number', 'part_number', 'part', 'partno'],
                date_manufactured: ['date manufactured', 'date_manufactured', 'manufactured', 'mfg date'],
                date_installed_issued: ['date installed', 'date issued', 'date_installed_issued', 'installed', 'issued'],
                date_last_pms: ['date of last pms', 'date_last_pms', 'date last pms', 'last pms'],
                date_last_repair: ['date of last repair', 'date_last_repair', 'date last repair', 'last repair'],
                running_hours: ['running hours', 'running_hours', 'runninghours'],
                status: ['status'],
                remarks: ['remarks', 'comments'],
                ics: ['ics'],
                par: ['par'],
                quantity: ['quantity', 'qty', 'count', 'qty.'],
                previous_report: ['previous report', 'previous', 'prev report'],
                expended: ['expended', 'expended qty'],
                replenished: ['replenished', 'replenished qty'],
                balance_on_hand: ['balance on hand', 'balance', 'boh']
            }

            const items: ValidatedItem[] = []
            const sectionHeaders = ['weapons', 'communication equipment', 'navigational sensors', 'ict equipment', 'ammunitions', 'ammunition']

            let currentSection = 'uncategorized'
            let currentColumnMap: Record<string, number> | null = null
            let currentRowIndex = 0

            while (currentRowIndex < jsonData.length) {
                const row = jsonData[currentRowIndex]
                if (!row || row.length === 0) {
                    currentRowIndex++
                    continue
                }

                const firstCell = String(row[0] || '').trim().toLowerCase()

                if (sectionHeaders.includes(firstCell)) {
                    currentSection = firstCell
                    currentRowIndex++

                    if (currentRowIndex < jsonData.length) {
                        const headerRow = jsonData[currentRowIndex]
                        if (headerRow && headerRow.length > 0) {
                            const headers = headerRow.map((h: any) => String(h).trim().toLowerCase())
                            currentColumnMap = {}
                            for (const [field, possibleNames] of Object.entries(fieldMappings)) {
                                for (const name of possibleNames) {
                                    const useExactOnly = ['ics', 'par'].includes(field)
                                    const index = headers.findIndex(h => h && (useExactOnly ? h === name : (h === name || h.includes(name))))
                                    if (index !== -1) {
                                        if (index === 0 && ['nr', 'no', 'number', '#'].includes(headers[index])) {
                                            continue
                                        }
                                        currentColumnMap[field] = index
                                        break
                                    }
                                }
                            }
                        }
                    }
                    currentRowIndex++
                    continue
                }

                if (currentColumnMap && Object.keys(currentColumnMap).length >= 3) {
                    const uniqueCode = String(row[currentColumnMap.unique_code] || '').trim()

                    if (uniqueCode && !['unique code', 'unique_code', 'code'].includes(uniqueCode.toLowerCase())) {
                        const brand = currentColumnMap.brand !== undefined ? String(row[currentColumnMap.brand] || '').trim() : ''
                        const model = currentColumnMap.model !== undefined ? String(row[currentColumnMap.model] || '').trim() : ''
                        const serial = currentColumnMap.serial_number !== undefined ? String(row[currentColumnMap.serial_number] || '').trim() : ''
                        const part = currentColumnMap.part_number !== undefined ? String(row[currentColumnMap.part_number] || '').trim() : ''
                        const qty = currentColumnMap.quantity !== undefined ? extractNumber(row[currentColumnMap.quantity]) : null

                        const prev = currentColumnMap.previous_report !== undefined ? extractNumber(row[currentColumnMap.previous_report]) : null
                        const exp = currentColumnMap.expended !== undefined ? extractNumber(row[currentColumnMap.expended]) : null
                        const rep = currentColumnMap.replenished !== undefined ? extractNumber(row[currentColumnMap.replenished]) : null
                        const boh = currentColumnMap.balance_on_hand !== undefined ? extractNumber(row[currentColumnMap.balance_on_hand]) : null

                        const dateMfg = currentColumnMap.date_manufactured !== undefined ? row[currentColumnMap.date_manufactured] : null
                        const dateInst = currentColumnMap.date_installed_issued !== undefined ? row[currentColumnMap.date_installed_issued] : null
                        const datePMS = currentColumnMap.date_last_pms !== undefined ? row[currentColumnMap.date_last_pms] : null
                        const dateRepair = currentColumnMap.date_last_repair !== undefined ? row[currentColumnMap.date_last_repair] : null
                        const runHours = currentColumnMap.running_hours !== undefined ? String(row[currentColumnMap.running_hours] || '').trim() : ''
                        const statusField = currentColumnMap.status !== undefined ? String(row[currentColumnMap.status] || '').trim() : ''
                        const remarksField = currentColumnMap.remarks !== undefined ? String(row[currentColumnMap.remarks] || '').trim() : ''
                        const icsField = currentColumnMap.ics !== undefined ? String(row[currentColumnMap.ics] || '').trim() : ''
                        const parField = currentColumnMap.par !== undefined ? String(row[currentColumnMap.par] || '').trim() : ''

                        items.push({
                            unique_code: uniqueCode,
                            section: currentSection,
                            classification: String(row[currentColumnMap.classification] || '').trim(),
                            nomenclature: String(row[currentColumnMap.nomenclature] || '').trim(),
                            brand,
                            model,
                            serial_number: serial,
                            part_number: part,
                            quantity: qty,
                            previous_report: prev,
                            expended: exp,
                            replenished: rep,
                            balance_on_hand: boh,
                            date_manufactured: dateMfg,
                            date_installed_issued: dateInst,
                            date_last_pms: datePMS,
                            date_last_repair: dateRepair,
                            running_hours: runHours,
                            status: statusField,
                            remarks: remarksField,
                            ics: icsField,
                            par: parField,
                            isMatched: uniqueCode.toLowerCase().includes(fileInfo.bow_number.toLowerCase()),
                            isDuplicate: false, // Updated below
                            rowNum: currentRowIndex + 1
                        })
                    }
                }
                currentRowIndex++
            }

            // Track internal duplicates
            const counts = new Map<string, number>()
            items.forEach(it => {
                counts.set(it.unique_code, (counts.get(it.unique_code) || 0) + 1)
            })

            items.forEach(it => {
                it.isDuplicate = (counts.get(it.unique_code) || 0) > 1
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

    const handleReset = () => {
        setFile(null)
        setFileInfo(null)
        setVerifiedPrefix(null)
        setVerificationError(null)
        setVerifiedData([])
        setVesselExists(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-4 text-foreground">
            {verificationError && (
                <div className="mb-4 flex items-center gap-2 text-sm text-error bg-error-bg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {verificationError}
                </div>
            )}

            {!file ? (
                <div className="border-2 border-dashed border-foreground/20 p-4 text-center hover:border-foreground/40 transition-colors bg-foreground/5 rounded-none">
                    <div className="w-16 h-16 bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-foreground" />
                    </div>
                    <h4 className="text-[16px] font-semibold text-foreground mb-2">Upload Monthly Report to Validate</h4>
                    <p className="text-sm text-foreground-muted mb-4">
                        Upload an Excel file (.xlsx or .xls) to verify its contents against the filename.
                    </p>
                    <p className="text-xs text-secondary mb-4 font-medium uppercase tracking-wider">
                        Filename must follow format: <span className="font-mono underline font-bold uppercase">(Bow)-MMYYYY.xlsx</span> (e.g. <span className="underline font-bold">LCF01-072026.xlsx</span>) to verify unique codes.
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
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
                    <div className="flex items-center justify-between p-4 bg-foreground/5 border border-foreground/10 rounded-none">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center rounded-none">
                                <FileSpreadsheet className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{file?.name}</p>
                                <div className="flex items-center gap-4 text-xs text-foreground-muted mt-1 uppercase font-semibold">
                                    <span>Detected Vessel: <span className="text-[#000080] font-black">{fileInfo?.bow_number}</span></span>
                                    <span>Report Period: <span className="text-[#000080] font-black">{fileInfo?.month_name} {fileInfo?.year}</span></span>
                                    {checkingVessel ? (
                                        <span className="text-foreground-muted">Checking Registration...</span>
                                    ) : vesselExists !== null && (
                                        vesselExists ? (
                                            <span className="text-emerald-700 font-bold bg-[#E6E6FA] px-2 py-0.5 border border-[#000080]/30 font-mono text-[10px]">Registered Vessel</span>
                                        ) : (
                                            <span className="text-red-700 font-bold bg-red-50/50 px-2 py-0.5 border border-red-300 font-mono text-[10px]">Unregistered Vessel</span>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="text-foreground-muted hover:text-error transition-colors p-1 hover:bg-error-bg rounded-none"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={handleVerify}
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
                        <div className="bg-emerald-950/20 border border-emerald-500 p-4 text-emerald-300 rounded-none">
                            <div className="flex items-center gap-3">
                                <Check className="w-6 h-6 text-emerald-400 shrink-0" />
                                <div>
                                    <h4 className="font-bold uppercase tracking-wider text-sm text-emerald-400">Verification Successful</h4>
                                    <p className="text-xs mt-1 text-emerald-200 uppercase tracking-widest font-semibold font-mono">
                                        All {verifiedData.length} records in this monthly report match the reference Bow prefix <span className="font-mono underline font-bold uppercase">{verifiedPrefix}</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-error-bg/30 border border-error p-4 text-error rounded-none">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-6 h-6 text-error shrink-0" />
                                <div>
                                    <h4 className="font-bold uppercase tracking-wider text-sm text-error">Discrepancies / Mismatches Detected</h4>
                                    <p className="text-xs mt-1 text-foreground font-semibold uppercase tracking-wider">
                                        {verifiedData.filter(item => !item.isMatched || item.isDuplicate).length} row(s) have problems. Check for incorrect prefix or duplicity below.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All rows checklist / verified ledger */}
                    <div className="border border-foreground/10 overflow-hidden rounded-none">
                        <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10 flex justify-between items-center text-foreground font-semibold">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-[#000080]">Verification Ledger</h4>
                                <p className="text-xs text-foreground-muted mt-0.5 font-medium">Filename Prefix: "{verifiedPrefix}" {vesselExists !== null && `• Registered: ${vesselExists ? 'YES' : 'NO'}`}</p>
                            </div>
                            <span className="text-xs font-bold text-foreground bg-foreground/10 px-2 py-1">
                                {verifiedData.length} Total Checked
                            </span>
                        </div>
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full min-w-[1500px] border-collapse">
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
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date Issued / Installed</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date of Last PMS</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Date of Last Repair</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">ICS</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">PAR</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Remarks</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Running Hours</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Previous Report</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Expended</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Replenished</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Balance on Hand</th>
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
                                                ) : item.isDuplicate ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-error-bg text-error border border-error/30">
                                                        [ DUPLICATE ]
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-error-bg text-error border border-error/30">
                                                        [ MISMATCHED ]
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-3 py-2 text-xs font-mono font-medium ${(item.isMatched && !item.isDuplicate) ? 'text-foreground font-semibold' : 'text-error font-bold'}`}>{item.unique_code}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground max-w-[200px] truncate">{item.nomenclature || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_manufactured) || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_last_pms) || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_last_repair) || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.status || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.remarks || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.running_hours || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.previous_report ?? '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.expended ?? '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.replenished ?? '-'}</td>
                                            <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{item.balance_on_hand ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="p-3 border-t border-foreground/10 flex justify-end gap-3 shrink-0 rounded-none bg-foreground/5">
                        <button
                            onClick={handleReset}
                            className="px-6 py-2.5 bg-[#E6E6FA] text-[#000033] hover:bg-[#E6E6FA]/80 transition-colors text-xs font-bold uppercase tracking-widest shadow-card rounded-none"
                        >
                            Verify Another File
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
