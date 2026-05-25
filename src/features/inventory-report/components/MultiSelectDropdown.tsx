'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

interface MultiSelectDropdownProps {
    label: string
    options: string[]
    selected: string[]
    onToggle: (val: string) => void
    disabled?: boolean
    emptyMessage?: string
}

export default function MultiSelectDropdown({
    label,
    options,
    selected,
    onToggle,
    disabled = false,
    emptyMessage = 'No options available'
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setSearch('')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()))

    const getDisplayText = () => {
        if (selected.length === 1) return selected[0]
        if (selected.length > 1) return `${selected.length} Selected`
        return `All ${label}`
    }

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                {label}
            </label>

            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-3 py-2.5 border ${open ? 'border-primary/50 ring-2 ring-primary/50' : 'border-foreground/10'} bg-background text-sm transition-all focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-foreground/5'}`}
            >
                <span className="truncate text-foreground pr-2">{getDisplayText()}</span>
                <ChevronDown className={`w-4 h-4 text-foreground-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1.5 w-full border border-foreground/10 bg-surface shadow-popover overflow-hidden flex flex-col">
                    {options.length > 5 && (
                        <div className="p-2 border-b border-foreground/5">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 border border-foreground/10 bg-background text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    <div className="max-h-48 overflow-y-auto py-1 divide-y divide-foreground/5">
                        {options.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-foreground-muted">{emptyMessage}</p>
                        ) : filteredOptions.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-foreground-muted">No matches</p>
                        ) : (
                            filteredOptions.map(opt => (
                                <label key={opt} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-foreground/5 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(opt)}
                                        onChange={() => onToggle(opt)}
                                        className="accent-primary w-3.5 h-3.5 shrink-0"
                                    />
                                    <span className="text-sm text-foreground truncate">{opt}</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
