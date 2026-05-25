'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
import type { FilterField } from '@/hooks/useInventoryReport'

interface FilterTagInputProps {
  label: string
  field: FilterField
  selectedValues: string[]
  onAdd: (field: FilterField, value: string) => void
  onRemove: (field: FilterField, value: string) => void
  getSuggestions: (field: FilterField, inputValue: string) => string[]
  placeholder?: string
}

export default function FilterTagInput({
  label,
  field,
  selectedValues,
  onAdd,
  onRemove,
  getSuggestions,
  placeholder,
}: FilterTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const visibleSuggestions = open
    ? getSuggestions(field, inputValue).filter(s => !selectedValues.includes(s))
    : []

  const handleSelect = (value: string) => {
    onAdd(field, value)
    setInputValue('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      onAdd(field, inputValue.trim())
      setInputValue('')
    }
    if (e.key === 'Escape') { setOpen(false); setInputValue('') }
    if (e.key === 'Backspace' && !inputValue && selectedValues.length > 0) {
      onRemove(field, selectedValues[selectedValues.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
        {label}
      </label>
      <div
        className="flex flex-wrap gap-1.5 min-h-[42px] px-2.5 py-1.5 border border-foreground/10 bg-background cursor-text focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent transition-all"
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
      >
        {selectedValues.map(val => (
          <span
            key={val}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/15 text-foreground text-xs font-medium shrink-0"
          >
            {val}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(field, val) }}
              className="text-foreground-muted hover:text-error transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedValues.length === 0 ? (placeholder ?? `Filter ${label}...`) : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none py-0.5"
        />
        <ChevronDown
          className={`w-4 h-4 text-foreground-muted self-center shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && visibleSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full  bg-surface border border-foreground/10 shadow-popover overflow-hidden">
          <ul className="max-h-48 overflow-y-auto py-1">
            {visibleSuggestions.map(suggestion => (
              <li key={suggestion}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10 transition-colors"
                >
                  {inputValue ? (
                    <HighlightMatch text={suggestion} query={inputValue} />
                  ) : suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && visibleSuggestions.length === 0 && inputValue && (
        <div className="absolute z-50 mt-1 w-full  bg-surface border border-foreground/10 shadow-popover px-3 py-2 text-sm text-foreground-muted">
          No matches — press Enter to add &quot;{inputValue}&quot;
        </div>
      )}
    </div>
  )
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}
