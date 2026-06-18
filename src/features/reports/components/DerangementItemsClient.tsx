'use client'

import React, { useState, useMemo } from 'react'
import { AlertTriangle, Search, XCircle, Ship, RefreshCw, ExternalLink, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDerangementItems, DerangementItem } from '@/hooks/useDerangementItems'
import { ReportListModal } from './ReportListModal'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

function formatReportMonth(reportMonth: string | null): string {
    if (!reportMonth) return '-'
    try {
        const [y, m] = reportMonth.split('-')
        return `${MONTHS[parseInt(m) - 1]} ${y}`
    } catch {
        return reportMonth
    }
}

export function DerangementItemsClient() {
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
    const { items, loading, error, refresh } = useDerangementItems({ month: selectedMonth, year: selectedYear })
    const [search, setSearch] = useState('')
    const [selectedItem, setSelectedItem] = useState<DerangementItem | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleViewReports = (item: DerangementItem) => {
        setSelectedItem(item)
        setIsModalOpen(true)
    }

    const filtered = useMemo(() => {
        if (!search.trim()) return items
        const q = search.trim().toLowerCase()
        return items.filter(item =>
            item.unique_code.toLowerCase().includes(q) ||
            item.nomenclature?.toLowerCase().includes(q) ||
            item.serial_number?.toLowerCase().includes(q) ||
            item.status?.toLowerCase().includes(q) ||
            item.remarks?.toLowerCase().includes(q) ||
            item.vessel_bow?.toLowerCase().includes(q) ||
            item.equipment_name?.toLowerCase().includes(q)
        )
    }, [items, search])

    return (
        <div className="space-y-3">
            {/* Controls Bar */}
            <div className="flex items-center gap-3 bg-surface border border-foreground/10 p-3 shadow-card">
                <MonthYearPicker
                    month={selectedMonth}
                    year={selectedYear}
                    onChange={(m, y) => {
                        setSelectedMonth(m)
                        setSelectedYear(y)
                    }}
                />

                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                    <input
                        type="text"
                        placeholder="Search by code, nomenclature, serial number, status, remarks..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 text-sm bg-background border border-foreground/10 text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            <XCircle className="w-4 h-4 text-foreground-muted hover:text-foreground" />
                        </button>
                    )}
                </div>
                <button
                    onClick={refresh}
                    title="Refresh"
                    className="p-2 border border-foreground/10 bg-background text-foreground-muted hover:text-primary hover:border-primary/30"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted whitespace-nowrap">
                    {filtered.length} Item{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
                </div>
            )}

            {/* Table */}
            <div className="bg-surface border border-foreground/10 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-primary">
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Vessel (Bow)
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Unique Code
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Nomenclature
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Serial Number
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Remarks
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-background">
                                    Report
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                                        Loading derangement items...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-foreground/5 flex items-center justify-center">
                                                <AlertTriangle className="w-6 h-6 text-foreground-muted" />
                                            </div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-foreground-muted">
                                                {search ? 'No items match your search' : 'No derangement reports found'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={`${item.vessel_id}-${item.item_id}`} className="hover:bg-foreground/3">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Ship className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span className="text-sm font-bold text-foreground uppercase">
                                                    {item.vessel_bow}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-black text-foreground uppercase tracking-tight">
                                                {item.unique_code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-foreground">
                                                {item.nomenclature || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-foreground-muted font-mono">
                                                {item.serial_number || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.equipment_name?.toUpperCase().includes('AMMUNIT') ? (
                                                <span className="text-foreground-muted">-</span>
                                            ) : (
                                                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${['OPERATING', 'OPERATIONAL', 'SERVICEABLE', 'GOOD', 'REPAIRED'].includes(item.status?.toUpperCase() || '')
                                                    ? 'bg-secondary/10 text-secondary border border-secondary/20'
                                                    : 'bg-error/10 text-error border border-error/20'
                                                    }`}>
                                                    {item.status || '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 max-w-[240px]">
                                            <span className="text-sm text-foreground-muted truncate block" title={item.remarks}>
                                                {item.remarks || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.file_path && (
                                                <button
                                                    onClick={() => handleViewReports(item)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    View Report
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ReportListModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                itemId={selectedItem?.item_id || null}
                vesselId={selectedItem?.vessel_id || null}
                vesselBow={selectedItem?.vessel_bow || null}
                itemCode={selectedItem?.unique_code || null}
                itemNomenclature={selectedItem?.nomenclature || null}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onRefresh={refresh}
            />
        </div>
    )
}
