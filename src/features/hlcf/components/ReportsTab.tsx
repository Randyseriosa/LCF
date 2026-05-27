'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileCheck, FileX, Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

interface MonthlyReport {
    report_month: string
}

export function ReportsTab() {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [reports, setReports] = useState<MonthlyReport[]>([])
    const [loading, setLoading] = useState(true)
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]

    // Generate years: 5 years back and 2 years forward from now
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 7 + i).reverse()

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true)
            const supabase = createClient()

            const startDate = `${selectedYear}-01-01`
            const endDate = `${selectedYear}-12-31`

            const { data, error } = await supabase
                .from('monthly_reports')
                .select('report_month')
                .gte('report_month', startDate)
                .lte('report_month', endDate)

            if (!error && data) {
                setReports(data)
            }
            setLoading(false)
        }

        fetchReports()
    }, [selectedYear])

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsYearDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const getStatus = (monthIndex: number) => {
        const monthNum = (monthIndex + 1).toString().padStart(2, '0')
        const reportDatePrefix = `${selectedYear}-${monthNum}`
        const isSubmitted = reports.some(r => r.report_month.startsWith(reportDatePrefix))

        return isSubmitted ? (
            <div className="flex items-center gap-2 text-accent">
                <FileCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Submitted</span>
            </div>
        ) : (
            <div className="flex items-center gap-2 text-foreground-muted/50">
                <FileX className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Not Submitted</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center bg-surface border border-foreground/10 p-4">
                <div className="flex items-center gap-6">
                    {/* Year Selector on the Left */}
                    <div className="relative" ref={dropdownRef}>
                        <div className="flex items-center bg-background border border-foreground/10 group h-10">
                            <button
                                onClick={() => setSelectedYear(prev => prev - 1)}
                                className="h-full px-2 hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors border-r border-foreground/10"
                                title="Previous Year"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                                className="flex items-center gap-3 px-4 h-full hover:bg-foreground/5 transition-colors"
                            >
                                <span className="text-[18px] font-bold text-primary tabular-nums tracking-tight">{selectedYear}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-foreground-muted transition-transform duration-200 ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <button
                                onClick={() => setSelectedYear(prev => prev + 1)}
                                className="h-full px-2 hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors border-l border-foreground/10"
                                title="Next Year"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Dropdown Menu */}
                        {isYearDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1 w-full bg-surface border border-foreground/20 z-50 py-1 max-h-60 overflow-y-auto">
                                {years.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => {
                                            setSelectedYear(year)
                                            setIsYearDropdownOpen(false)
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${selectedYear === year
                                            ? 'bg-primary text-background'
                                            : 'text-foreground hover:bg-foreground/5'
                                            }`}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-foreground-muted border-l border-foreground/10 pl-6 h-8">
                        <Calendar className="w-4 h-4" />
                        <h2 className="text-xs font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                            Monthly Reports Summary
                        </h2>
                    </div>
                </div>
            </div>

            <div className="bg-surface border border-foreground/10 overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-foreground/5 text-left border-b border-foreground/10">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-foreground">Month</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-foreground">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/5">
                        {months.map((month, index) => (
                            <tr key={month} className="hover:bg-foreground/2 transition-colors group">
                                <td className="px-6 py-4 text-sm font-semibold text-foreground uppercase tracking-wider italic group-hover:text-primary transition-colors">
                                    {month}
                                </td>
                                <td className="px-6 py-4">
                                    {loading ? (
                                        <div className="w-24 h-4 bg-foreground/5 animate-pulse" />
                                    ) : (
                                        getStatus(index)
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
