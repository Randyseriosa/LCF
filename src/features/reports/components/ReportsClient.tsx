'use client'

import React, { useState } from 'react'

import { Filter, FileText, Trash2, AlertTriangle } from 'lucide-react'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { useClassesOfVessel, type ClassOfVessel } from '@/hooks/useClassesOfVessel'
import { getValidAccessToken } from '@/lib/auth'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

interface ReportsClientProps {
    basePath: string
    showClearButton?: boolean
}

export function ReportsClient({ basePath, showClearButton = false }: ReportsClientProps) {
    const { classesOfVessel, loading: loadingClasses } = useClassesOfVessel()

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedClass, setSelectedClass] = useState<string | null>(null)
    const [isClearing, setIsClearing] = useState(false)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)


    const handleClearReports = async () => {
        setIsClearing(true)
        try {
            const token = await getValidAccessToken()
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
            }
        } catch (err) {
            alert('Error clearing reports: ' + (err as Error).message)
        } finally {
            setIsClearing(false)
        }
    }

    return (
        <div className="space-y-3">
            {/* Header with Month/Year Selector and Filters */}
            <div className=" border border-foreground/5  bg-surface p-3 shadow-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Month/Year Selector */}
                    <MonthYearPicker
                        month={selectedMonth}
                        year={selectedYear}
                        onChange={(m, y) => {
                            setSelectedMonth(m)
                            setSelectedYear(y)
                        }}
                    />

                    {/* Class of Vessel Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-foreground-muted" />
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

                        {/* Clear Reports Button - Admin Only */}
                        {showClearButton && (
                            <button
                                onClick={() => setShowConfirmDialog(true)}
                                disabled={isClearing}
                                className="flex items-center gap-2 border border-error/30 bg-error-bg px-4 py-2 text-error hover:bg-error-bg disabled:opacity-50 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>{isClearing ? 'Clearing...' : 'Clear All Reports'}</span>
                            </button>
                        )}
                    </div>
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

            {/* Reports Table */}
            <div className=" border border-foreground/5  bg-surface shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <tbody>
                            {/* Empty State */}
                            <tr>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <div className="mb-4 flex h-14 w-14 items-center justify-center bg-secondary/30">
                                            <FileText className="w-7 h-7 text-foreground-muted" />
                                        </div>
                                        <h3 className="text-foreground font-semibold text-[20px] mb-2">
                                            No reports available
                                        </h3>
                                        <p className="text-foreground-muted text-sm max-w-sm">
                                            Reports for {MONTHS[selectedMonth]} {selectedYear} will appear here once data is imported.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

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
