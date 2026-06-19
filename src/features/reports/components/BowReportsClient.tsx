'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useVesselsWithReportStatus } from '@/hooks/useVesselsWithReportStatus'
import { useMonthlyReportAttachments } from '@/hooks/useMonthlyReportAttachments'
import { Filter, CheckCircle, XCircle, ChevronDown, ChevronRight, Trash2, AlertTriangle, FileText, Search, X, Paperclip } from 'lucide-react'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { SuccessModal } from '@/components/ui/SuccessModal'


const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

interface BowReportsClientProps {
    basePath: string
}

export function BowReportsClient({ basePath }: BowReportsClientProps) {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('lcf_monthly_report_month')
            return saved !== null ? parseInt(saved) : new Date().getMonth()
        }
        return new Date().getMonth()
    })
    const [selectedYear, setSelectedYear] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('lcf_monthly_report_year')
            return saved !== null ? parseInt(saved) : new Date().getFullYear()
        }
        return new Date().getFullYear()
    })
    const [bowNumberFilter, setBowNumberFilter] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lcf_monthly_report_bowFilter') || ''
        }
        return ''
    })
    const [submittedStatus, setSubmittedStatus] = useState<'submitted' | 'not-submitted' | 'all'>(() => {
        if (typeof window !== 'undefined') {
            return (sessionStorage.getItem('lcf_monthly_report_statusFilter') as any) || 'all'
        }
        return 'all'
    })
    const [isClearing, setIsClearing] = useState(false)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)

    const { vessels, loading, error, refresh } = useVesselsWithReportStatus({
        month: selectedMonth,
        year: selectedYear,
        classOfVesselId: null,
        bowNumberFilter: bowNumberFilter || null,
        submittedStatus
    })

    const { attachments, loading: loadingAttachments } = useMonthlyReportAttachments({
        month: selectedMonth,
        year: selectedYear
    })

    const attachmentVesselIds = new Set(attachments.map(a => a.vessel_id))

    const [hasAction, setHasAction] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lcf_monthly_report_hasAction') === 'true'
        }
        return false
    })

    // Persistence Effects
    React.useEffect(() => {
        sessionStorage.setItem('lcf_monthly_report_month', selectedMonth.toString())
        sessionStorage.setItem('lcf_monthly_report_year', selectedYear.toString())
    }, [selectedMonth, selectedYear])

    React.useEffect(() => {
        sessionStorage.setItem('lcf_monthly_report_bowFilter', bowNumberFilter)
    }, [bowNumberFilter])

    React.useEffect(() => {
        sessionStorage.setItem('lcf_monthly_report_statusFilter', submittedStatus)
    }, [submittedStatus])

    React.useEffect(() => {
        sessionStorage.setItem('lcf_monthly_report_hasAction', hasAction.toString())
    }, [hasAction])


    const handleClearReports = async () => {
        setIsClearing(true)
        try {
            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-monthly-report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            const data = await res.json()
            if (!res.ok) {
                alert('Failed to clear reports: ' + (data.error || res.statusText))
            } else {
                setShowSuccessModal(true)
                setShowConfirmDialog(false)
                refresh()
            }
        } catch (err) {
            alert('Error clearing reports: ' + (err as Error).message)
        } finally {
            setIsClearing(false)
        }
    }


    const hasAnyFilter = bowNumberFilter || submittedStatus !== 'all'
    const activeFilterCount = (bowNumberFilter ? 1 : 0) + (submittedStatus !== 'all' ? 1 : 0)

    const handleShowAll = () => {
        setHasAction(true)
        setBowNumberFilter('')
        setSubmittedStatus('all')
    }

    const clearAllFilters = () => {
        setBowNumberFilter('')
        setSubmittedStatus('all')
        setHasAction(true)
    }

    const selectClass = 'w-full px-3 py-2 border border-foreground/10 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all'

    // Metrics for the summary header
    const totalVessels = vessels.length
    const submittedCount = vessels.filter(v => v.submitted).length
    const pendingCount = totalVessels - submittedCount

    return (
        <div className="space-y-6">
            {/* ── Status Summary ── */}
            {!loading && !error && vessels.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-foreground/10 bg-surface shadow-card">
                    <div className="p-4 border-b md:border-b-0 md:border-r border-foreground/10">
                        <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] mb-1">Bow</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-foreground leading-none">{totalVessels}</span>
                            <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Total Bow</span>
                        </div>
                    </div>
                    <div className="p-4 border-b md:border-b-0 md:border-r border-foreground/10 bg-success/[0.02]">
                        <p className="text-[10px] font-bold text-success uppercase tracking-[0.2em] mb-1">Reports Received</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-success leading-none">{submittedCount}</span>
                            <span className="text-[10px] font-bold text-success/60 uppercase tracking-widest">[{Math.round((submittedCount / totalVessels) * 100) || 0}%]</span>
                        </div>
                    </div>
                    <div className="p-4 bg-foreground/[0.02]">
                        <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] mb-1">Pending Submission</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-foreground-muted leading-none">{pendingCount}</span>
                            <span className="text-[10px] font-bold text-foreground-muted/60 uppercase tracking-widest">Outstanding</span>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-surface shadow-card border border-foreground/10 overflow-hidden">
                {/* ── Search Toolbar ── */}
                <div className="p-3">
                    <div className="flex flex-col lg:flex-row items-end gap-3 translate-y-[-1px]">
                        {/* Month/Year Selector */}
                        <div className="shrink-0 w-full lg:w-auto">
                            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1.5 block">Report Period</label>
                            <MonthYearPicker
                                month={selectedMonth}
                                year={selectedYear}
                                onChange={(m, y) => {
                                    setSelectedMonth(m)
                                    setSelectedYear(y)
                                }}
                            />
                        </div>

                        {/* Search Bow Number */}
                        <div className="w-full lg:flex-1 shrink-0">
                            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1.5 block">Bow Number</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={bowNumberFilter}
                                    onChange={(e) => {
                                        setBowNumberFilter(e.target.value)
                                        if (e.target.value) setHasAction(true)
                                    }}
                                    className="w-full pl-9 pr-4 py-2 border border-foreground/10 bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm h-11"
                                />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="w-full lg:flex-1 shrink-0">
                            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1.5 block">Status</label>
                            <select
                                value={submittedStatus}
                                onChange={(e) => {
                                    setSubmittedStatus(e.target.value as 'submitted' | 'not-submitted' | 'all')
                                    setHasAction(true)
                                }}
                                className={`${selectClass} h-11`}
                            >
                                <option value="all">All Statuses</option>
                                <option value="submitted">Submitted</option>
                                <option value="not-submitted">Not Submitted</option>
                            </select>
                        </div>

                        {/* Clear Button */}
                        {hasAnyFilter && (
                            <div className="shrink-0 h-11">
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-1.5 px-4 h-full text-error hover:bg-error-bg transition-all text-sm font-bold uppercase tracking-wider border border-transparent hover:border-error/20"
                                >
                                    <X className="w-4 h-4" />
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Table Section ── */}
                <div className="border-t border-foreground/10">

                    {loading && (
                        <div className="px-5 py-8 text-center text-foreground-muted text-sm">
                            Loading vessels...
                        </div>
                    )}

                    {error && (
                        <div className="px-5 py-4 text-error text-sm">
                            {error}
                        </div>
                    )}

                    {!loading && !error && vessels.length === 0 && hasAction && (
                        <div className="px-5 py-10 text-center">
                            <FileText className="w-8 h-8 text-foreground-muted mx-auto mb-3" />
                            <p className="text-foreground-muted text-sm">No vessels found matching the filters.</p>
                            {hasAnyFilter && (
                                <button onClick={clearAllFilters} className="mt-3 text-sm text-primary hover:underline font-bold uppercase tracking-wider">
                                    Clear filters to see all vessels
                                </button>
                            )}
                        </div>
                    )}

                    {!loading && !error && vessels.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed">
                                <thead className="bg-foreground/5 border-b border-foreground/10">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap">Bow</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap w-40">Status</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap w-40">Attachment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!hasAction && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center bg-foreground/[0.01]">
                                                <button
                                                    onClick={handleShowAll}
                                                    className="inline-flex items-center px-10 py-4 bg-primary text-white hover:bg-primary/90 transition-all shadow-xl text-[11px] font-black uppercase tracking-[0.3em] group"
                                                >
                                                    Show All Vessels
                                                    <ChevronRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                    {hasAction && vessels.map((vessel, vIndex) => (
                                        <tr
                                            key={vessel.id}
                                            className={`hover:bg-foreground/[0.01] transition-colors ${vIndex === vessels.length - 1 ? 'border-b border-foreground/10' : 'border-b border-foreground/5'}`}
                                        >
                                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                {vessel.bow_number ? (
                                                    vessel.submitted ? (
                                                        <Link
                                                            href={`${basePath}/monthly-report/${vessel.bow_number}?month=${selectedMonth}&year=${selectedYear}`}
                                                            className="text-primary hover:text-primary/70 transition-colors font-bold uppercase tracking-widest flex items-center gap-2 group"
                                                        >
                                                            {vessel.bow_number}
                                                            <div className="flex-1 border-b border-dotted border-primary/20 mx-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            <ChevronRight className="w-3 h-3 transition-all -translate-x-1 group-hover:translate-x-0" />
                                                        </Link>
                                                    ) : (
                                                        <div className="text-foreground-muted font-bold uppercase tracking-widest flex items-center gap-2 cursor-not-allowed opacity-30">
                                                            {vessel.bow_number}
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className="text-foreground-muted font-bold uppercase tracking-widest">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap text-right w-40">
                                                <div className="flex items-center justify-end">
                                                    {vessel.submitted ? (
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 text-success rounded-none">
                                                            <CheckCircle className="w-3 h-3" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Submitted</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 px-2.5 py-1 bg-foreground/5 border border-foreground/10 text-foreground-muted rounded-none">
                                                            <XCircle className="w-3 h-3" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Pending</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap text-right w-40">
                                                <div className="flex items-center justify-end">
                                                    {attachmentVesselIds.has(vessel.id) ? (
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 text-success rounded-none">
                                                            <CheckCircle className="w-3 h-3" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Attached</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 px-2.5 py-1 bg-foreground/5 border border-foreground/10 text-foreground-muted rounded-none">
                                                            <XCircle className="w-3 h-3" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">No File</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="px-6 py-4 bg-foreground/[0.02] border-t border-foreground/10">
                                <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
                                    Total Vessels: {vessels.length}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md border border-foreground/10  bg-surface p-3 shadow-card">
                        <div className="mb-4 flex h-8 w-8 items-center justify-center bg-error-bg">
                            <AlertTriangle className="h-6 w-6 text-error" />
                        </div>
                        <h3 className="mb-2 text-foreground font-semibold text-[20px]">
                            Clear All Monthly Reports?
                        </h3>
                        <p className="mb-3 text-foreground-muted text-sm">
                            This will permanently delete all monthly report data from the system. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                disabled={isClearing}
                                className=" border border-foreground/10 bg-surface px-4 py-2 text-foreground hover:bg-foreground/5 disabled:opacity-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearReports}
                                disabled={isClearing}
                                className=" bg-error px-4 py-2 text-white hover:bg-error/90 disabled:opacity-50 transition-colors"
                            >
                                {isClearing ? 'Clearing...' : 'Clear All Reports'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dev Phase: Floating Clear All Reports Button */}
            <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={isClearing}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-error px-5 py-3 text-white shadow-lg hover:bg-error/90 disabled:opacity-50 transition-all hover:scale-105"
            >
                <Trash2 className="w-4 h-4" />
                <span className="font-medium">{isClearing ? 'Clearing...' : 'Clear All Reports'}</span>
            </button>

            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="REPORTS CLEARED"
                message="All monthly report data has been successfully removed from the system."
            />
        </div>
    )
}
