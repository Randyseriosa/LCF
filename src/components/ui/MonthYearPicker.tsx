'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

interface MonthYearPickerProps {
    month: number // 0-11
    year: number
    onChange: (month: number, year: number) => void
    className?: string
}

export function MonthYearPicker({ month, year, onChange, className = '' }: MonthYearPickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [view, setView] = useState<'month' | 'year'>('month')
    const containerRef = useRef<HTMLDivElement>(null)

    // Reset view when opening
    useEffect(() => {
        if (isOpen) setView('month')
    }, [isOpen])

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handlePrevMonth = () => {
        if (month === 0) {
            onChange(11, year - 1)
        } else {
            onChange(month - 1, year)
        }
    }

    const handleNextMonth = () => {
        if (month === 11) {
            onChange(0, year + 1)
        } else {
            onChange(month + 1, year)
        }
    }

    const selectedYearRef = useRef<HTMLButtonElement>(null)

    // Scroll to selected year when year view is opened
    useEffect(() => {
        if (view === 'year' && selectedYearRef.current) {
            selectedYearRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
        }
    }, [view])

    // Generate more years for the scrollable list
    const yearList = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i).reverse()

    return (
        <div className={`flex items-center gap-1 ${className}`} ref={containerRef}>
            {/* Quick Navigation - Previous */}
            <button
                onClick={handlePrevMonth}
                className="flex h-11 w-11 items-center justify-center border border-foreground/10 bg-surface hover:bg-foreground/5 text-foreground-muted hover:text-primary"
                title="Previous Month"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Main Picker Button */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex h-11 items-center gap-4 px-5 border border-foreground/10 bg-surface hover:bg-foreground/5 min-w-[200px] justify-between group"
                >
                    <div className="flex items-center gap-4">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-foreground tabular-nums">
                            {MONTHS[month]} {year}
                        </span>
                    </div>
                    <div className={`w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-foreground-muted group-hover:border-t-primary ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Popover */}
                {isOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-[280px] bg-surface border border-foreground/20 z-50 shadow-2xl overflow-hidden">
                        {/* Year Header */}
                        <div className="flex items-center justify-between p-2 border-b border-foreground/10 bg-foreground/5">
                            <button
                                onClick={() => onChange(month, year - 1)}
                                className="p-1 hover:bg-foreground/10 text-foreground-muted hover:text-primary"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setView(view === 'month' ? 'year' : 'month')}
                                className="px-3 py-1 hover:bg-foreground/10 text-xs font-bold text-foreground tabular-nums tracking-[0.2em] border border-transparent hover:border-foreground/10"
                            >
                                {year}
                            </button>
                            <button
                                onClick={() => onChange(month, year + 1)}
                                className="p-1 hover:bg-foreground/10 text-foreground-muted hover:text-primary"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {view === 'month' ? (
                            <div className="p-2 grid grid-cols-3 gap-1">
                                {MONTHS.map((m, index) => (
                                    <button
                                        key={m}
                                        onClick={() => {
                                            onChange(index, year)
                                            setIsOpen(false)
                                        }}
                                        className={`px-2 py-3 text-[10px] font-bold uppercase tracking-widest ${month === index
                                            ? 'bg-primary text-background'
                                            : 'text-foreground hover:bg-foreground/10'
                                            }`}
                                    >
                                        {m.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-2 h-[164px] overflow-y-auto grid grid-cols-3 gap-1 custom-scrollbar scroll-smooth">
                                {yearList.map(y => (
                                    <button
                                        key={y}
                                        ref={year === y ? selectedYearRef : null}
                                        onClick={() => {
                                            onChange(month, y)
                                            setView('month')
                                        }}
                                        className={`px-2 py-3 text-[10px] font-bold uppercase tracking-widest ${year === y
                                            ? 'bg-primary text-background'
                                            : 'text-foreground hover:bg-foreground/10'
                                            }`}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-2 border-t border-foreground/10 flex justify-center bg-foreground/5">
                            <button
                                onClick={() => {
                                    const now = new Date()
                                    onChange(now.getMonth(), now.getFullYear())
                                    setIsOpen(false)
                                }}
                                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 py-1"
                            >
                                Current Period
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Navigation - Next */}
            <button
                onClick={handleNextMonth}
                className="flex h-11 w-11 items-center justify-center border border-foreground/10 bg-surface hover:bg-foreground/5 text-foreground-muted hover:text-primary"
                title="Next Month"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    )
}
