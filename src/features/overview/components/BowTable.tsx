'use client'

import React, { useMemo, useState } from 'react'
import { Ship, Loader2, Inbox, Search, ArrowUpDown } from 'lucide-react'
import { useBowNumbers } from '@/features/overview/hooks/useBowNumbers'

interface BowTableProps {
    classId: string
    className: string
}

type SortField = 'bow_number' | 'created_at'
type SortDirection = 'asc' | 'desc'

export function BowTable({ classId, className: vesselClassName }: BowTableProps) {
    const { bowNumbers, loading, error } = useBowNumbers(classId)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortField, setSortField] = useState<SortField>('bow_number')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const filtered = useMemo(() => {
        let items = [...bowNumbers]

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            items = items.filter(
                (v) => v.bow_number?.toLowerCase().includes(q)
            )
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0
            if (sortField === 'bow_number') {
                cmp = (a.bow_number || '').localeCompare(b.bow_number || '')
            } else {
                cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            return sortDirection === 'asc' ? cmp : -cmp
        })

        return items
    }, [bowNumbers, searchQuery, sortField, sortDirection])

    if (loading) {
        return (
            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                        <Ship className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-[20px] font-semibold text-foreground">
                        {vesselClassName} — Bow Numbers
                    </h2>
                </div>
                <div className="flex items-center justify-center py-3 text-foreground-muted">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Loading bow numbers…
                </div>
            </section>
        )
    }

    if (error) {
        return (
            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                        <Ship className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-[20px] font-semibold text-foreground">
                        {vesselClassName} — Bow Numbers
                    </h2>
                </div>
                <div className="p-4 bg-error-bg border border-error/20 text-error text-sm">
                    {error}
                </div>
            </section>
        )
    }

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4  bg-surface p-4 shadow-card sm:p-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-secondary/40">
                        <Ship className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                        <h2 className="text-[20px] font-semibold text-foreground leading-tight">
                            {vesselClassName}
                        </h2>
                        <p className="text-sm text-foreground-muted">Bow Numbers</p>
                    </div>
                    <span className="ml-2 bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground">
                        {bowNumbers.length}
                    </span>
                </div>

                <div className="relative max-w-xs w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                    <input
                        id="bow-search"
                        type="text"
                        placeholder="Search bow number…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border border-foreground/10 bg-background py-2.5 pl-9 pr-4 text-sm text-foreground transition-shadow placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </div>
            </div>
            {bowNumbers.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-foreground/5 bg-surface p-4 text-center shadow-card sm:p-3">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center bg-secondary/30">
                        <Inbox className="w-7 h-7 text-foreground-muted" />
                    </div>
                    <h3 className="text-foreground font-semibold text-[20px] mb-2">No Bow Numbers</h3>
                    <p className="text-foreground-muted text-sm max-w-xs">
                        No bow numbers have been added for this class of vessel yet.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden border border-foreground/5  bg-surface shadow-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-foreground/10 bg-background">
                                    <th className="w-12 px-4 py-4 text-left text-xs font-semibold text-foreground-muted sm:px-4">
                                        #
                                    </th>
                                    <th className="px-4 py-4 text-left sm:px-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('bow_number')}
                                            className="inline-flex items-center gap-1.5 text-foreground-muted font-semibold hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0 text-xs"
                                        >
                                            Bow Number
                                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === 'bow_number' ? 'text-primary' : 'text-foreground/30'}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-4 text-left sm:px-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('created_at')}
                                            className="inline-flex items-center gap-1.5 text-foreground-muted font-semibold hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0 text-xs"
                                        >
                                            Date Added
                                            <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === 'created_at' ? 'text-primary' : 'text-foreground/30'}`} />
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-4 text-foreground-muted">
                                            No bow numbers match your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((vessel, index) => (
                                        <tr
                                            key={vessel.id}
                                            className="border-b border-foreground/5 transition-colors last:border-b-0 hover:bg-secondary/10"
                                        >
                                            <td className="px-4 py-2 text-xs tabular-nums text-foreground-muted whitespace-nowrap sm:px-4">
                                                {index + 1}
                                            </td>
                                            <td className="px-4 py-2 text-xs font-medium text-foreground whitespace-nowrap sm:px-4">
                                                {vessel.bow_number || '—'}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-foreground-muted whitespace-nowrap sm:px-4">
                                                {new Date(vessel.created_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    )
}
