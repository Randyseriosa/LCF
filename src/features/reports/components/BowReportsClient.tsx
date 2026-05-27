'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useVesselsWithReportStatus } from '@/hooks/useVesselsWithReportStatus'
import { useClassesOfVessel } from '@/hooks/useClassesOfVessel'
import { Filter, CheckCircle, XCircle, ChevronDown, ChevronRight, Trash2, AlertTriangle } from 'lucide-react'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'


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

    return (
        <div className="space-y-3">
            {/* Header with Filters */}
            <div className=" border border-foreground/5  bg-surface p-3 shadow-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Month/Year Selector */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground-muted uppercase tracking-widest text-[10px]">Report Period</label>
                        <MonthYearPicker
                            month={selectedMonth}
                            year={selectedYear}
                            onChange={(m, y) => {
                                setSelectedMonth(m)
                                setSelectedYear(y)
                            }}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-foreground-muted flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Bow
                            </label>
                            <input
                                type="text"
                                value={bowNumberFilter}
                                onChange={(e) => setBowNumberFilter(e.target.value)}
                                placeholder="Search bow number..."
                                className=" border border-foreground/10 bg-surface px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-foreground-muted flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Classification
                            </label>
                            <select
                                value={selectedClass || ''}
                                onChange={(e) => setSelectedClass(e.target.value || null)}
                                className=" border border-foreground/10 bg-surface px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                disabled={loadingClasses}
                            >
                                <option value="">All Classes</option>
                                {classesOfVessel.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-foreground-muted flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Status
                            </label>
                            <select
                                value={submittedStatus}
                                onChange={(e) => setSubmittedStatus(e.target.value as 'submitted' | 'not-submitted' | 'all')}
                                className=" border border-foreground/10 bg-surface px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                <option value="all">All Statuses</option>
                                <option value="submitted">Submitted</option>
                                <option value="not-submitted">Not Submitted</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className=" border border-foreground/5  bg-surface p-3 shadow-card text-center">
                    <div className="text-foreground-muted">Loading vessels...</div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className=" border border-error/30 bg-error-bg p-3 shadow-card">
                    <div className="text-error">{error}</div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && vessels.length === 0 && (
                <div className=" border border-foreground/5  bg-surface p-3 shadow-card text-center">
                    <div className="text-foreground-muted">No vessels found matching the filters.</div>
                </div>
            )}

            {/* Vessels Table */}
            {!loading && !error && vessels.length > 0 && (
                <div className=" border border-foreground/5  bg-surface shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-foreground/5">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Bow</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Classification of Vessel</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {showGroupedView ? (
                                    // Grouped view by class
                                    classGroups.map((group) => (
                                        <React.Fragment key={group.id}>
                                            <tr
                                                className="border-t border-foreground/5 cursor-pointer hover:bg-foreground/5"
                                                onClick={() => toggleClassExpansion(group.id)}
                                            >
                                                <td colSpan={3} className="px-4 py-2 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {expandedClasses.has(group.id) ? (
                                                            <ChevronDown className="w-4 h-4 text-foreground-muted" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-foreground-muted" />
                                                        )}
                                                        <span className="font-medium text-foreground">{group.name}</span>
                                                        <span className="text-sm text-foreground-muted">({group.vessels.length})</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedClasses.has(group.id) && group.vessels.map((vessel) => (
                                                <tr key={vessel.id} className="border-t border-foreground/5">
                                                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                                                        {vessel.bow_number ? (
                                                            <Link
                                                                href={`${basePath}/reports/${vessel.bow_number}?month=${selectedMonth}&year=${selectedYear}`}
                                                                className="text-foreground hover:text-secondary transition-colors font-medium"
                                                            >
                                                                {vessel.bow_number}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-foreground">N/A</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                                                        <span className="text-foreground-muted">{vessel.class_of_vessel?.name || 'N/A'}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                                                        {vessel.submitted ? (
                                                            <div className="flex items-center gap-2 text-success">
                                                                <CheckCircle className="w-4 h-4" />
                                                                <span className="text-sm">Submitted</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-foreground-muted">
                                                                <XCircle className="w-4 h-4" />
                                                                <span className="text-sm">Not Submitted</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    // Flat view when class is filtered
                                    vessels.map((vessel) => (
                                        <tr key={vessel.id} className="border-t border-foreground/5">
                                            <td className="px-4 py-2 text-xs whitespace-nowrap">
                                                {vessel.bow_number ? (
                                                    <Link
                                                        href={`${basePath}/reports/${vessel.bow_number}?month=${selectedMonth}&year=${selectedYear}`}
                                                        className="text-foreground hover:text-secondary transition-colors font-medium"
                                                    >
                                                        {vessel.bow_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-foreground">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-xs whitespace-nowrap">
                                                <span className="text-foreground-muted">{vessel.class_of_vessel?.name || 'N/A'}</span>
                                            </td>
                                            <td className="px-4 py-2 text-xs whitespace-nowrap">
                                                {vessel.submitted ? (
                                                    <div className="flex items-center gap-2 text-success">
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span className="text-sm">Submitted</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-foreground-muted">
                                                        <XCircle className="w-4 h-4" />
                                                        <span className="text-sm">Not Submitted</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
