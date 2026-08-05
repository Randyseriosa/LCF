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

export function ReportsClient({ basePath }: ReportsClientProps) {
    const { classesOfVessel, loading: loadingClasses } = useClassesOfVessel()

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedClass, setSelectedClass] = useState<string | null>(null)

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

                    </div>
                </div>
            </div>

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
        </div>
    )
}
