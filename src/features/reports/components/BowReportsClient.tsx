'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useVesselsWithReportStatus } from '@/hooks/useVesselsWithReportStatus'
import { useClassesOfVessel } from '@/hooks/useClassesOfVessel'
import { Filter, CheckCircle, XCircle, ChevronDown, ChevronRight, Trash2, AlertTriangle, FileText, Search, X } from 'lucide-react'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { PageHeader } from '@/components/layout/PageHeader'


const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

interface BowReportsClientProps {
    basePath: string
}

export function BowReportsClient({ basePath }: BowReportsClientProps) {
    const { classesOfVessel, loading: loadingClasses } = useClassesOfVessel()
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedClass, setSelectedClass] = useState<string | null>(null)
    const [bowNumberFilter, setBowNumberFilter] = useState('')
    const [submittedStatus, setSubmittedStatus] = useState<'submitted' | 'not-submitted' | 'all'>('all')
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
    const [isClearing, setIsClearing] = useState(false)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)

    const { vessels, loading, error, refresh } = useVesselsWithReportStatus({
        month: selectedMonth,
        year: selectedYear,
        classOfVesselId: selectedClass,
        bowNumberFilter: bowNumberFilter || null,
        submittedStatus
    })

    const toggleClassExpansion = (classId: string) => {
        setExpandedClasses(prev => {
            const newSet = new Set(prev)
            if (newSet.has(classId)) {
                newSet.delete(classId)
            } else {
                newSet.add(classId)
            }
            return newSet
        })
    }

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
                alert('Monthly reports cleared successfully')
                setShowConfirmDialog(false)
                refresh()
            }
        } catch (err) {
            alert('Error clearing reports: ' + (err as Error).message)
        } finally {
            setIsClearing(false)
        }
    }

    // Group vessels by class of vessel
    const vesselsByClass = vessels.reduce((acc, vessel) => {
        const classId = vessel.class_of_vessel?.id || 'uncategorized'
        const className = vessel.class_of_vessel?.name || 'Uncategorized'
        if (!acc[classId]) {
            acc[classId] = {
                id: classId,
                name: className,
                vessels: []
            }
        }
        acc[classId].vessels.push(vessel)
        return acc
    }, {} as Record<string, { id: string; name: string; vessels: typeof vessels }>)

    const classGroups = Object.values(vesselsByClass)

    // Determine if we should show grouped view (when no specific class is selected)
    const showGroupedView = !selectedClass

    const hasAnyFilter = selectedClass || bowNumberFilter || submittedStatus !== 'all'
    const activeFilterCount = (selectedClass ? 1 : 0) + (bowNumberFilter ? 1 : 0) + (submittedStatus !== 'all' ? 1 : 0)

    const [hasAction, setHasAction] = useState(false)

    const handleShowAll = () => {
        setHasAction(true)
        setSelectedClass(null)
        setBowNumberFilter('')
        setSubmittedStatus('all')
    }

    const clearAllFilters = () => {
        setSelectedClass(null)
        setBowNumberFilter('')
        setSubmittedStatus('all')
        setHasAction(true)
    }

    const selectClass = 'w-full px-3 py-2 border border-foreground/10 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all'



    return (
        <div className="space-y-6">
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

                        {/* Classification Filter */}
                        <div className="w-full lg:flex-1 shrink-0">
                            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1.5 block">Classification</label>
                            <select
                                value={selectedClass || ''}
                                onChange={(e) => {
                                    setSelectedClass(e.target.value || null)
                                    setHasAction(true)
                                }}
                                className={`${selectClass} h-11`}
                                disabled={loadingClasses}
                            >
                                <option value="">Select Classification...</option>
                                {classesOfVessel.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
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
                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap w-80">Classification of Vessel</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap w-40">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!hasAction && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center bg-foreground/[0.01]">
                                                <button
                                                    onClick={handleShowAll}
                                                    className="inline-flex items-center px-8 py-3 bg-primary text-white hover:bg-primary/90 transition-all shadow-lg text-[11px] font-black uppercase tracking-[0.2em]"
                                                >
                                                    Show All
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                    {hasAction && (showGroupedView ? (
                                        // Grouped view by class
                                        classGroups.map((group) => (
                                            <React.Fragment key={group.id}>
                                                <tr
                                                    className="border-b border-foreground/5 cursor-pointer hover:bg-foreground/5"
                                                    onClick={() => toggleClassExpansion(group.id)}
                                                >
                                                    <td colSpan={3} className="px-6 py-3 whitespace-nowrap bg-foreground/[0.02]">
                                                        <div className="flex items-center gap-2">
                                                            {expandedClasses.has(group.id) ? (
                                                                <ChevronDown className="w-4 h-4 text-primary" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-primary" />
                                                            )}
                                                            <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">{group.name}</span>
                                                            <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">({group.vessels.length} Vessel{group.vessels.length !== 1 ? 's' : ''})</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedClasses.has(group.id) && group.vessels.map((vessel, vIndex) => (
                                                    <tr
                                                        key={vessel.id}
                                                        className={`hover:bg-foreground/[0.01] transition-colors ${vIndex === group.vessels.length - 1 ? 'border-b border-foreground/10' : 'border-b border-foreground/5'}`}
                                                    >
                                                        <td className="px-6 py-4 text-xs whitespace-nowrap pl-12">
                                                            {vessel.bow_number ? (
                                                                <Link
                                                                    href={`${basePath}/monthly-report/${vessel.bow_number}?month=${selectedMonth}&year=${selectedYear}`}
                                                                    className="text-primary hover:text-primary/70 transition-colors font-bold uppercase tracking-widest flex items-center gap-2 group"
                                                                >
                                                                    {vessel.bow_number}
                                                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                                                                </Link>
                                                            ) : (
                                                                <span className="text-foreground-muted font-bold uppercase tracking-widest">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs whitespace-nowrap w-80">
                                                            <span className="text-foreground font-medium uppercase tracking-wider text-[11px]">{vessel.class_of_vessel?.name || 'N/A'}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs whitespace-nowrap text-right w-40">
                                                            <div className="flex items-center justify-end">
                                                                {vessel.submitted ? (
                                                                    <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 text-success rounded-none">
                                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest">Submitted</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 px-3 py-1 bg-foreground/5 border border-foreground/10 text-foreground-muted rounded-none">
                                                                        <XCircle className="w-3.5 h-3.5" />
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest">Pending</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        // Flat view when class is filtered
                                        vessels.map((vessel, vIndex) => (
                                            <tr
                                                key={vessel.id}
                                                className={`hover:bg-foreground/[0.01] transition-colors ${vIndex === vessels.length - 1 ? 'border-b border-foreground/10' : 'border-b border-foreground/5'}`}
                                            >
                                                <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                    {vessel.bow_number ? (
                                                        <Link
                                                            href={`${basePath}/monthly-report/${vessel.bow_number}?month=${selectedMonth}&year=${selectedYear}`}
                                                            className="text-primary hover:text-primary/70 transition-colors font-bold uppercase tracking-widest flex items-center gap-2 group"
                                                        >
                                                            {vessel.bow_number}
                                                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                                                        </Link>
                                                    ) : (
                                                        <span className="text-foreground-muted font-bold uppercase tracking-widest">N/A</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-xs whitespace-nowrap w-80">
                                                    <span className="text-foreground font-medium uppercase tracking-wider text-[11px]">{vessel.class_of_vessel?.name || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-xs whitespace-nowrap text-right w-40">
                                                    <div className="flex items-center justify-end">
                                                        {vessel.submitted ? (
                                                            <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 text-success rounded-none">
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-widest">Submitted</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 px-3 py-1 bg-foreground/5 border border-foreground/10 text-foreground-muted rounded-none">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-widest">Pending</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
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
        </div>
    )
}
