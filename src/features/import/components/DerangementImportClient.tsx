'use client'

import React, { useState, useRef, useMemo } from 'react'
import { Upload, FileText, AlertCircle, Search, XCircle, ChevronRight, Anchor, Check, Ship, Calendar, Clock, ExternalLink } from 'lucide-react'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { getAuthUser } from '@/lib/auth'
import { useVessels } from '@/hooks/useVessels'
import { useVesselItems, VesselItem } from '@/hooks/useVesselItems'
import { createClient } from '@/lib/supabase/client'
import { useRecentDerangementImports } from '@/hooks/useRecentDerangementImports'

type DerangementStep = 'select-bow' | 'select-items' | 'derangement-reports'

interface SelectedItemReport {
    item: VesselItem
    files: File[]
    remarks: string
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

export function DerangementImportClient() {
    const [step, setStep] = useState<DerangementStep>('select-bow')
    const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null)
    const [selectedVesselBow, setSelectedVesselBow] = useState<string>('')
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
    const [bowSearch, setBowSearch] = useState('')
    const [itemSearch, setItemSearch] = useState('')
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItemReport>>(new Map())
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [successModalData, setSuccessModalData] = useState({ title: '', message: '' })
    const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

    const { vessels, loading: loadingVessels } = useVessels()
    const { items: vesselItems, loading: loadingItems } = useVesselItems(selectedVesselId, { month: selectedMonth, year: selectedYear })
    const { imports: recentImports, loading: loadingHistory, refresh: refreshHistory } = useRecentDerangementImports(5)

    // Filter vessels by search
    const filteredVessels = useMemo(() => {
        if (!bowSearch.trim()) return vessels
        const search = bowSearch.trim().toLowerCase()
        return vessels.filter(v =>
            v.bow_number?.toLowerCase().includes(search) ||
            v.class_of_vessel?.name?.toLowerCase().includes(search)
        )
    }, [vessels, bowSearch])

    // Filter items by search
    const filteredItems = useMemo(() => {
        if (!itemSearch.trim()) return vesselItems
        const search = itemSearch.trim().toLowerCase()
        return vesselItems.filter(item =>
            item.unique_code.toLowerCase().includes(search) ||
            item.nomenclature?.toLowerCase().includes(search) ||
            item.serial_number?.toLowerCase().includes(search) ||
            item.equipment_name.toLowerCase().includes(search) ||
            item.classification?.toLowerCase().includes(search)
        )
    }, [vesselItems, itemSearch])

    const handleSelectVessel = (vesselId: string, bowNumber: string) => {
        setSelectedVesselId(vesselId)
        setSelectedVesselBow(bowNumber)
        setSelectedItems(new Map())
        setStep('select-items')
        setError(null)
    }

    const handleToggleItem = (item: VesselItem) => {
        setSelectedItems(prev => {
            const next = new Map(prev)
            if (next.has(item.id)) {
                next.delete(item.id)
            } else {
                next.set(item.id, { item, files: [], remarks: item.monthly_remarks || '' })
            }
            return next
        })
    }

    const handleProceedToUpload = () => {
        if (selectedItems.size === 0) {
            setError('Please select at least one item.')
            return
        }
        setError(null)
        setStep('derangement-reports')
    }

    const handleFileAdd = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        const pdfFiles = files.filter(f => f.type === 'application/pdf')
        if (pdfFiles.length !== files.length) {
            setError('Only PDF files are accepted.')
            return
        }
        setError(null)

        setSelectedItems(prev => {
            const next = new Map(prev)
            const entry = next.get(itemId)
            if (entry) {
                next.set(itemId, { ...entry, files: [...entry.files, ...pdfFiles] })
            }
            return next
        })

        // Reset the input so the same file can be added again if needed
        if (e.target) e.target.value = ''
    }

    const handleRemoveFile = (itemId: string, fileIndex: number) => {
        setSelectedItems(prev => {
            const next = new Map(prev)
            const entry = next.get(itemId)
            if (entry) {
                const newFiles = [...entry.files]
                newFiles.splice(fileIndex, 1)
                next.set(itemId, { ...entry, files: newFiles })
            }
            return next
        })
    }

    const handleRemarksChange = (itemId: string, remarks: string) => {
        setSelectedItems(prev => {
            const next = new Map(prev)
            const entry = next.get(itemId)
            if (entry) {
                next.set(itemId, { ...entry, remarks })
            }
            return next
        })
    }

    const handleSubmit = async () => {
        // Validate: all items should have at least one PDF
        const itemsWithoutFiles = Array.from(selectedItems.values()).filter(s => s.files.length === 0)
        if (itemsWithoutFiles.length > 0) {
            setError(`The following items have no PDF attached: ${itemsWithoutFiles.map(s => s.item.unique_code).join(', ')}`)
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const user = await getAuthUser()
            if (!user) throw new Error('Not authenticated')

            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const supabase = createClient()

            // Submit each item's reports
            for (const [itemId, entry] of selectedItems.entries()) {
                for (const file of entry.files) {
                    // Convert file to base64
                    const fileBuffer = await file.arrayBuffer()
                    const uint8Array = new Uint8Array(fileBuffer)
                    let binary = ''
                    const chunkSize = 8192
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize))
                    }
                    const base64 = btoa(binary)
                    const fileData = `data:application/pdf;base64,${base64}`

                    const { data, error: functionError } = await supabase.functions.invoke('import-derangement-report', {
                        body: {
                            file_data: fileData,
                            filename: file.name,
                            vessel_id: selectedVesselId,
                            item_id: itemId,
                            remarks: entry.remarks,
                            report_month: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
                        },
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    })

                    if (functionError) {
                        throw new Error(functionError.message || `Failed to upload ${file.name}`)
                    }

                    if (data?.error) {
                        throw new Error(data.error)
                    }
                }
            }

            const itemCount = selectedItems.size
            setSuccessModalData({
                title: 'Import Successful',
                message: `Derangement reports for ${itemCount} item${itemCount > 1 ? 's' : ''} on ${selectedVesselBow} uploaded successfully.`
            })
            setShowSuccessModal(true)

            // Refresh history
            refreshHistory()

            // Reset
            setStep('select-bow')
            setSelectedVesselId(null)
            setSelectedVesselBow('')
            setSelectedItems(new Map())
            setItemSearch('')
            setBowSearch('')
        } catch (err: any) {
            setError(err.message || 'Failed to submit derangement reports')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBack = () => {
        setError(null)
        if (step === 'select-items') {
            setStep('select-bow')
            setSelectedVesselId(null)
            setSelectedVesselBow('')
            setSelectedItems(new Map())
        } else if (step === 'derangement-reports') {
            setStep('select-items')
        }
    }

    return (
        <div className="space-y-3">
            {/* ── Step Indicator ── */}
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground-muted mb-2">
                <span className={step === 'select-bow' ? 'text-primary' : selectedVesselId ? 'text-success' : ''}>
                    1. Select Bow
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className={step === 'select-items' ? 'text-primary' : step === 'derangement-reports' ? 'text-success' : ''}>
                    2. Select Items
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className={step === 'derangement-reports' ? 'text-primary' : ''}>
                    3. Derangement Reports
                </span>
            </div>

            {/* ── Selected Context Bar ── */}
            {selectedVesselId && step !== 'select-bow' && (
                <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <Ship className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{selectedVesselBow}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span>
                    </div>
                    {selectedItems.size > 0 && (
                        <>
                            <span className="text-foreground-muted">•</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">
                                {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''} Selected
                            </span>
                        </>
                    )}
                    <button onClick={handleBack} className="ml-auto text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-foreground transition-colors">
                        ← Back
                    </button>
                </div>
            )}

            {/* ── Error Banner ── */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest leading-relaxed">{error}</p>
                </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* STEP 1: Select Bow                               */}
            {/* ═════════════════════════════════════════════════ */}
            {step === 'select-bow' && (
                <div className="bg-surface p-4 shadow-card border border-foreground/10 space-y-6">
                    <div>
                        <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground mb-3">Report Month & Year</h3>
                        <MonthYearPicker
                            month={selectedMonth}
                            year={selectedYear}
                            onChange={(m, y) => {
                                setSelectedMonth(m)
                                setSelectedYear(y)
                            }}
                        />
                    </div>

                    <div>
                        <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground mb-3">Select Vessel (Bow)</h3>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                            <input
                                type="text"
                                placeholder="Search by bow number or class..."
                                value={bowSearch}
                                onChange={e => setBowSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-foreground/10 text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                            />
                            {bowSearch && (
                                <button onClick={() => setBowSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <XCircle className="w-4 h-4 text-foreground-muted hover:text-foreground" />
                                </button>
                            )}
                        </div>

                        {!bowSearch.trim() ? (
                            <div className="py-12 border-2 border-dashed border-foreground/5 flex flex-col items-center justify-center text-center">
                                <Ship className="w-12 h-12 text-foreground/5 mb-4" />
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground-muted max-w-[200px]">
                                    Enter Bow Number or Vessel Class to search
                                </p>
                            </div>
                        ) : loadingVessels ? (
                            <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                                Loading vessels...
                            </div>
                        ) : filteredVessels.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                                No vessels found matching "{bowSearch}"
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                {filteredVessels.map(vessel => (
                                    <button
                                        key={vessel.id}
                                        onClick={() => handleSelectVessel(vessel.id, vessel.bow_number || vessel.slug)}
                                        className="flex flex-col items-center gap-2 p-4 border border-foreground/10 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all group text-center"
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center bg-foreground/5 group-hover:bg-primary/10 transition-colors">
                                            <Anchor className="w-5 h-5 text-foreground-muted group-hover:text-primary transition-colors" />
                                        </div>
                                        <span className="text-sm font-black text-foreground uppercase tracking-tight">{vessel.bow_number || vessel.slug}</span>
                                        {vessel.class_of_vessel && (
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{vessel.class_of_vessel.name}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* STEP 2: Select Items                             */}
            {/* ═════════════════════════════════════════════════ */}
            {step === 'select-items' && (
                <div className="bg-surface p-4 shadow-card border border-foreground/10">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">Select Items with Derangement</h3>
                        <button
                            onClick={handleProceedToUpload}
                            disabled={selectedItems.size === 0}
                            className="bg-primary text-background px-5 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card"
                        >
                            Proceed ({selectedItems.size})
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                        <input
                            type="text"
                            placeholder="Search items by code, name, serial number, equipment..."
                            value={itemSearch}
                            onChange={e => setItemSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-foreground/10 text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                        />
                        {itemSearch && (
                            <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <XCircle className="w-4 h-4 text-foreground-muted hover:text-foreground" />
                            </button>
                        )}
                    </div>

                    {loadingItems ? (
                        <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                            Loading items...
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                            {itemSearch ? 'No items match your search' : 'No items assigned to this vessel'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-foreground/5">
                            <table className="w-full text-left">
                                <thead className="bg-background sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted w-10"></th>
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Serial Number</th>
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-foreground/5">
                                    {filteredItems.map(item => {
                                        const isSelected = selectedItems.has(item.id)
                                        return (
                                            <tr
                                                key={item.id}
                                                className={`transition-colors ${isSelected
                                                    ? 'bg-primary/10 hover:bg-primary/15'
                                                    : 'hover:bg-foreground/5'
                                                    }`}
                                            >
                                                <td className="px-3 py-2.5 text-center cursor-pointer" onClick={() => handleToggleItem(item)}>
                                                    <div className={`w-5 h-5 border flex items-center justify-center transition-all ${isSelected
                                                        ? 'bg-primary border-primary'
                                                        : 'border-foreground/20 hover:border-foreground/40'
                                                        }`}>
                                                        {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-sm font-bold text-foreground cursor-pointer" onClick={() => handleToggleItem(item)}>{item.unique_code}</td>
                                                <td className="px-3 py-2.5 text-sm text-foreground cursor-pointer" onClick={() => handleToggleItem(item)}>{item.nomenclature || '-'}</td>
                                                <td className="px-3 py-2.5 text-sm text-foreground-muted cursor-pointer" onClick={() => handleToggleItem(item)}>{item.serial_number || '-'}</td>
                                                <td className="px-3 py-2.5 text-sm cursor-pointer" onClick={() => handleToggleItem(item)}>
                                                    {item.equipment_name?.toUpperCase().includes('AMMUNIT') || item.equipment_code === 'AM' ? (
                                                        <span className="text-foreground-muted">-</span>
                                                    ) : (
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${['OPERATING', 'OPERATIONAL', 'SERVICEABLE', 'GOOD'].includes(item.status?.toUpperCase() || '')
                                                            ? 'bg-secondary/10 text-secondary border border-secondary/20'
                                                            : 'bg-primary/10 text-primary border border-primary/20'
                                                            }`}>
                                                            {item.status || '-'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-sm text-foreground-muted truncate max-w-[200px]" title={item.monthly_remarks || ''}>
                                                    {item.monthly_remarks || '-'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* STEP 3: Upload Reports for Selected Items        */}
            {/* ═════════════════════════════════════════════════ */}
            {step === 'derangement-reports' && (
                <div className="space-y-3">
                    <div className="bg-surface p-4 shadow-card border border-foreground/10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">
                                Upload Derangement Reports
                            </h3>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="bg-accent text-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-secondary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card"
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit All Reports'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {Array.from(selectedItems.entries()).map(([itemId, entry]) => (
                                <div key={itemId} className="border border-foreground/10 bg-background">
                                    {/* Item Header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-foreground/5 border-b border-foreground/10">
                                        <div>
                                            <span className="text-sm font-black text-foreground uppercase">{entry.item.unique_code}</span>
                                            <span className="text-xs text-foreground-muted ml-3">{entry.item.nomenclature || ''}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                                                {entry.files.length} PDF{entry.files.length !== 1 ? 's' : ''}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setSelectedItems(prev => {
                                                        const next = new Map(prev)
                                                        next.delete(itemId)
                                                        return next
                                                    })
                                                }}
                                                className="text-foreground-muted hover:text-red-500 transition-colors"
                                                title="Remove item"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {/* File list */}
                                        {entry.files.length > 0 && (
                                            <div className="space-y-1.5">
                                                {entry.files.map((file, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-foreground/5 py-1.5 px-3 border border-foreground/10">
                                                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                                        <span className="text-xs font-medium text-foreground truncate flex-1">{file.name}</span>
                                                        <span className="text-[10px] text-foreground-muted">{(file.size / 1024).toFixed(0)} KB</span>
                                                        <button
                                                            onClick={() => handleRemoveFile(itemId, idx)}
                                                            className="text-foreground-muted hover:text-red-500 transition-colors"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add PDF button */}
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                multiple
                                                className="hidden"
                                                id={`file-input-${itemId}`}
                                                onChange={e => handleFileAdd(itemId, e)}
                                                ref={el => {
                                                    if (el) fileInputRefs.current.set(itemId, el)
                                                }}
                                            />
                                            <label
                                                htmlFor={`file-input-${itemId}`}
                                                className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-primary/20 transition-colors border border-primary/20"
                                            >
                                                <Upload className="w-3 h-3" />
                                                Add PDF
                                            </label>
                                        </div>


                                    </div>
                                </div>
                            ))}
                        </div>

                        {selectedItems.size === 0 && (
                            <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                                No items selected. Go back to select items.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Recent History Section ── */}
            <div className="mt-8 pt-8 border-t border-foreground/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-foreground">Recent Report Imports</h3>
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="bg-surface border border-foreground/10 p-8 text-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Loading history...</span>
                    </div>
                ) : recentImports.length === 0 ? (
                    <div className="bg-surface border border-foreground/10 p-8 text-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">No recent imports found.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recentImports.map((imp) => (
                            <div key={imp.id} className="bg-surface border border-foreground/10 p-4 shadow-card hover:border-primary/30 transition-all group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-8 h-8 bg-red-500/10 flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-red-500" />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">
                                        {new Date(imp.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-foreground uppercase tracking-tight truncate mb-1" title={imp.filename}>
                                    {imp.filename}
                                </h4>
                                <div className="flex flex-col gap-1 mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <Ship className="w-3 h-3 text-primary" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{imp.vessel_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3 text-primary" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                                            {(() => {
                                                const [y, m] = imp.report_month.split('-')
                                                return `${MONTHS[parseInt(m) - 1]} ${y}`
                                            })()}
                                        </span>
                                    </div>
                                </div>
                                <a
                                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/derangement-reports/${imp.file_path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2 bg-foreground/5 hover:bg-primary/10 text-foreground-muted hover:text-primary border border-foreground/10 hover:border-primary/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Open Report
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Success Modal ── */}
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title={successModalData.title}
                message={successModalData.message}
            />
        </div>
    )
}
