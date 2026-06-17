'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Eye, FileText, Search, XCircle, ExternalLink, Calendar, Clock, X, Ship, Trash2, Loader2 } from 'lucide-react'
import { useDerangementItems, useItemDerangementReports, DerangementItem } from '@/hooks/useDerangementItems'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, AuthUser } from '@/lib/auth'

const formatDate = (dateString: string): string => {
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

interface ViewReportModalProps {
    item: DerangementItem
    onClose: () => void
}

function ViewReportModal({ item, onClose }: ViewReportModalProps) {
    const { reports, loading } = useItemDerangementReports(item.item_id, item.vessel_id)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-surface w-[700px] max-h-[80vh] flex flex-col border border-foreground/10 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-primary text-background border-b border-foreground/10">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Derangement Reports</h3>
                        <p className="text-xs opacity-70 mt-0.5">{item.unique_code} — {item.nomenclature}</p>
                    </div>
                    <button onClick={onClose} className="hover:opacity-70 transition-opacity">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Item Details */}
                <div className="px-6 py-4 border-b border-foreground/10 bg-foreground/5">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted block mb-0.5">Unique Code</span>
                            <span className="text-sm font-bold text-foreground">{item.unique_code}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted block mb-0.5">Vessel</span>
                            <span className="text-sm font-bold text-foreground">{item.vessel_bow}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted block mb-0.5">Equipment</span>
                            <span className="text-sm text-foreground">{item.equipment_name}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted block mb-0.5">Serial Number</span>
                            <span className="text-sm text-foreground">{item.serial_number || '-'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted block mb-0.5">Status</span>
                            <span className="text-sm text-foreground">{item.status || '-'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted block mb-0.5">Remarks</span>
                            <span className="text-sm text-foreground">{item.remarks || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Reports List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-foreground-muted mb-3">
                        PDF Reports ({loading ? '...' : reports.length})
                    </h4>

                    {loading ? (
                        <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                            Loading reports...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                            No PDF reports found for this item.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {reports.map(report => (
                                <div key={report.id} className="flex items-center gap-3 border border-foreground/10 bg-background px-4 py-3 hover:bg-foreground/5 transition-colors group">
                                    <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 shrink-0">
                                        <FileText className="w-5 h-5 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{report.filename}</p>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                                                <Calendar className="w-3 h-3" />
                                                {formatReportMonth(report.report_month)}
                                            </span>
                                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                                                <Clock className="w-3 h-3" />
                                                {formatDate(report.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <a
                                        href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/derangement-reports/${report.file_path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 bg-primary text-background px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors shrink-0"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Open PDF
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-foreground/10 bg-foreground/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-foreground border border-foreground/10 hover:bg-foreground/5 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

export function DerangementItemsClient() {
    const { items, loading, error, refresh } = useDerangementItems()
    const [search, setSearch] = useState('')
    const [viewItem, setViewItem] = useState<DerangementItem | null>(null)
    const [isClearing, setIsClearing] = useState(false)
    const [showConfirmClear, setShowConfirmClear] = useState(false)
    const [user, setUser] = useState<AuthUser | null>(null)

    useEffect(() => {
        getAuthUser().then(setUser)
    }, [])

    const canClear = user?.role === 'admin' || user?.role === 'encoder'

    const handleClearAll = async () => {
        setIsClearing(true)
        try {
            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const supabase = createClient()
            const { data, error: clearError } = await supabase.functions.invoke('clear-derangement-reports', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (clearError) throw clearError

            console.log('[DerangementItemsClient] Clear success:', data)
            setShowConfirmClear(false)
            refresh()
        } catch (err: any) {
            console.error('[DerangementItemsClient] Clear error:', err)
            alert('Failed to clear reports: ' + (err.message || 'Unknown error'))
        } finally {
            setIsClearing(false)
        }
    }

    // Filter items
    const filteredItems = useMemo(() => {
        if (!search.trim()) return items
        const s = search.trim().toLowerCase()
        return items.filter(item =>
            (item.unique_code || '').toLowerCase().includes(s) ||
            (item.nomenclature || '').toLowerCase().includes(s) ||
            (item.serial_number || '').toLowerCase().includes(s) ||
            (item.vessel_bow || '').toLowerCase().includes(s) ||
            (item.equipment_name || '').toLowerCase().includes(s) ||
            (item.status || '').toLowerCase().includes(s) ||
            (item.remarks || '').toLowerCase().includes(s)
        )
    }, [items, search])

    // Group by vessel for display
    const groupedByVessel = useMemo(() => {
        const groups = new Map<string, { bow: string; items: DerangementItem[] }>()
        filteredItems.forEach(item => {
            if (!groups.has(item.vessel_id)) {
                groups.set(item.vessel_id, { bow: item.vessel_bow, items: [] })
            }
            groups.get(item.vessel_id)!.items.push(item)
        })
        return Array.from(groups.entries()).sort((a, b) => a[1].bow.localeCompare(b[1].bow))
    }, [filteredItems])

    if (loading) {
        return (
            <div className="bg-surface p-4 shadow-card border border-foreground/10">
                <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-foreground-muted">
                    Loading derangement items...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface p-4 border border-foreground/10 shadow-card">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Total Items</p>
                    <p className="text-2xl font-black text-foreground">{items.length}</p>
                </div>
                <div className="bg-surface p-4 border border-foreground/10 shadow-card">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Vessels Affected</p>
                    <p className="text-2xl font-black text-foreground">
                        {new Set(items.map(i => i.vessel_id)).size}
                    </p>
                </div>
                <div className="bg-surface p-4 border border-foreground/10 shadow-card">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1">Total Reports</p>
                    <p className="text-2xl font-black text-foreground">
                        {items.reduce((sum, i) => sum + i.report_count, 0)}
                    </p>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-surface p-4 shadow-card border border-foreground/10">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-bold uppercase tracking-widest text-foreground">Items with Derangement Reports</h3>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                    <input
                        type="text"
                        placeholder="Search by code, name, vessel, serial number..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-foreground/10 text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <XCircle className="w-4 h-4 text-foreground-muted hover:text-foreground" />
                        </button>
                    )}
                </div>

                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
                        <div className="w-16 h-16 mb-6 flex items-center justify-center bg-foreground/5 border border-foreground/10">
                            <AlertTriangle className="w-8 h-8 text-primary opacity-50" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">
                            {search ? 'No matching items' : 'No Derangement Reports'}
                        </h3>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50 max-w-xs text-center">
                            {search ? 'Try adjusting your search query.' : 'Import derangement reports to see them listed here.'}
                        </p>
                    </div>
                ) : (
                    groupedByVessel.map(([vesselId, group]) => (
                        <div key={vesselId} className="border border-foreground/10 overflow-hidden mb-4 last:mb-0">
                            {/* Vessel Group Header */}
                            <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10 flex items-center gap-2">
                                <Ship className="w-4 h-4 text-primary" />
                                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">{group.bow}</h4>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted ml-2">
                                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-background">
                                        <tr>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Bow Number</th>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Unique Code</th>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Nomenclature</th>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Serial Number</th>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Status</th>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Remarks</th>
                                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted text-right">Reports</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-foreground/5">
                                        {group.items.map(item => (
                                            <tr key={item.id} className="hover:bg-foreground/5 transition-colors">
                                                <td className="px-3 py-2.5 text-sm font-bold text-foreground">{item.vessel_bow}</td>
                                                <td className="px-3 py-2.5 text-sm font-bold text-foreground">{item.unique_code}</td>
                                                <td className="px-3 py-2.5 text-sm text-foreground">{item.nomenclature || '-'}</td>
                                                <td className="px-3 py-2.5 text-sm text-foreground-muted">{item.serial_number || '-'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest bg-warning/20 text-warning">
                                                        {item.status || 'DERANGED'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-sm text-foreground-muted max-w-[200px] truncate" title={item.remarks}>
                                                    {item.remarks || '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <button
                                                        onClick={() => setViewItem(item)}
                                                        className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors border border-primary/20"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* View Report Modal */}
            {viewItem && (
                <ViewReportModal
                    item={viewItem}
                    onClose={() => setViewItem(null)}
                />
            )}

            {/* Floating Clear Button (Temporary) - Only for Admin/Encoder */}
            {canClear && (
                <div className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-3">
                    {showConfirmClear && (
                        <div className="bg-surface border-2 border-primary p-4 shadow-2xl mb-2 max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <p className="text-[10px] font-black uppercase tracking-widest text-foreground mb-3">
                                Are you sure you want to clear ALL derangement reports from the system? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowConfirmClear(false)}
                                    disabled={isClearing}
                                    className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-foreground/10 hover:bg-foreground/5 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    disabled={isClearing}
                                    className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    Clear All
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setShowConfirmClear(!showConfirmClear)}
                        className="w-14 h-14 bg-primary text-background shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group relative"
                        title="Clear All Reports"
                    >
                        <Trash2 className="w-6 h-6" />
                        <span className="absolute right-full mr-4 px-3 py-1.5 bg-primary text-background text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Clear All Reports
                        </span>
                    </button>
                </div>
            )}
        </div>
    )
}
