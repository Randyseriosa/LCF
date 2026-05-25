'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export interface Option {
    label: string
    value: string
}

interface SearchableSelectProps {
    options: Option[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Select an option',
    disabled = false,
    className = ''
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setSearch('')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isOpen])

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(search.toLowerCase()) ||
        option.value.toLowerCase().includes(search.toLowerCase())
    )

    // Ensure we limit the number of rendered items if needed, but 100-200 is fine in standard DOM.
    // The user explicitly stated "show only limited", so let's limit it to 50 results in the dropdown.
    const limitedOptions = filteredOptions.slice(0, 50)

    const selectedOption = options.find(opt => opt.value === value)

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between py-2.5 px-3 border ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-foreground/10'} bg-background text-sm text-foreground focus:outline-none transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-foreground/5'}`}
                disabled={disabled}
            >
                <span className="truncate">
                    {selectedOption ? selectedOption.label : <span className="text-foreground-muted">{placeholder}</span>}
                </span>
                <ChevronDown className={`w-4 h-4 text-foreground-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full border border-foreground/10 bg-surface shadow-popover overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-foreground/5 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-foreground/10 bg-background text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {limitedOptions.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-foreground-muted text-center uppercase tracking-widest">
                                No results found
                            </div>
                        ) : (
                            limitedOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-foreground/5 transition-colors ${option.value === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                                    onClick={() => {
                                        onChange(option.value)
                                        setIsOpen(false)
                                        setSearch('')
                                    }}
                                >
                                    {option.label}
                                </button>
                            ))
                        )}
                        {filteredOptions.length > 50 && (
                            <div className="px-3 py-2 text-xs text-foreground-muted text-center italic bg-foreground/5">
                                Showing 50 of {filteredOptions.length} results. Please type to search.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
