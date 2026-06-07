'use client'

import { useState } from 'react'
import { Search, X, Filter, FileText, Download } from 'lucide-react'
import { useInventoryReport, FILTER_FIELDS, EQUIPMENT_CATEGORIES } from '@/hooks/useInventoryReport'
import { ROLES } from '@/lib/types/roles'
import FilterTagInput from './FilterTagInput'
import BowGroup from './BowGroup'
import MultiSelectDropdown from './MultiSelectDropdown'
import { PageHeader } from '@/components/layout/PageHeader'
import { getEquipmentGroupLabel } from '@/features/equipment/utils/equipmentGroup'



interface InventoryReportPageProps {
  role?: string
}

export default function InventoryReportPage({ role = ROLES.viewer }: InventoryReportPageProps) {
  const {
    items, loading, error,
    filters, addFilter, removeFilter, updateKeyword, clearFilters,
    getSuggestions, hasActiveFilters, activeFilterCount,
    classFilter, bowFilter, toggleClassFilter, toggleBowFilter,
    equipmentCategoryFilter, setEquipmentCategoryFilter,
    availableClasses, availableBows, bowGroups,
  } = useInventoryReport()
  const [showFilters, setShowFilters] = useState(false)

  const selectClass = 'w-full px-3 py-2.5 border border-foreground/10 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all'

  const handleExport = () => {
    if (items.length === 0) return

    const headers = [
      'Bow Number', 'Class of Vessel', 'Unique Code', 'Classification', 'Nomenclature',
      'Brand', 'Model', 'Serial Number', 'Part Number', 'ICS', 'PAR', 'Status'
    ]

    const rows = items.map(item => [
      item.monthly_reports?.vessels?.bow_number || '',
      item.monthly_reports?.vessels?.class_of_vessel?.name || '',
      item.unique_code,
      item.classification,
      item.nomenclature,
      item.brand,
      item.model,
      item.serial_number,
      item.part_number,
      item.ics,
      item.par,
      item.status
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }



  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Inventory View"
        description={`Total Vessels: ${bowGroups.length}`}
        Icon={FileText}
        actions={
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all border bg-white text-primary border-primary hover:bg-primary hover:text-white"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            Export Summary
          </button>
        }
      />

      {/* Search and Filters */}
      <div className="  bg-surface p-3 shadow-card border border-foreground/10 space-y-4">
        {/* Search Bar and Filter Toggle in one row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search items — keyword, unique code, classification, nomenclature, brand, model, ICS, PAR…"
              value={filters.keyword}
              onChange={(e) => updateKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-foreground/10 bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground transition-all shrink-0"
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-primary text-white text-xs font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-3 text-error hover:bg-error-bg transition-all text-sm shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {(classFilter.length > 0 || bowFilter.length > 0 || equipmentCategoryFilter || FILTER_FIELDS.some(f => filters[f].length > 0)) && (
          <div className="flex flex-wrap gap-2">
            {classFilter.map(cls => (
              <span key={`class:${cls}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
                <span className="text-foreground-muted">class:</span>
                <span>{cls}</span>
                <button onClick={() => toggleClassFilter(cls)} className="ml-0.5 text-foreground-muted hover:text-error transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {bowFilter.map(bow => (
              <span key={`bow:${bow}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
                <span className="text-foreground-muted">bow:</span>
                <span>{bow}</span>
                <button onClick={() => toggleBowFilter(bow)} className="ml-0.5 text-foreground-muted hover:text-error transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {equipmentCategoryFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
                <span className="text-foreground-muted">category:</span>
                <span>{getEquipmentGroupLabel(equipmentCategoryFilter as any)}</span>
                <button onClick={() => setEquipmentCategoryFilter('')} className="ml-0.5 text-foreground-muted hover:text-error transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {FILTER_FIELDS.map(field =>
              filters[field].map(val => (
                <span
                  key={`${field}:${val}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 text-xs font-medium text-foreground"
                >
                  <span className="text-foreground-muted capitalize">{field}:</span>
                  <span>{val}</span>
                  <button onClick={() => removeFilter(field, val)} className="ml-0.5 text-foreground-muted hover:text-error transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        )}

        {/* Filter Fields */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-foreground/10">
            {/* Class of Vessels — multi-select dropdown */}
            <MultiSelectDropdown
              label="Class of Vessels"
              options={availableClasses}
              selected={classFilter}
              onToggle={toggleClassFilter}
              emptyMessage="No classes available"
            />

            {/* Bow — multi-select dropdown */}
            <MultiSelectDropdown
              label="Bows"
              options={availableBows}
              selected={bowFilter}
              onToggle={toggleBowFilter}
              disabled={availableBows.length === 0}
              emptyMessage="No bows available"
            />

            {/* Equipment Category */}
            <div>
              <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
                Equipment Category
              </label>
              <select value={equipmentCategoryFilter} onChange={e => setEquipmentCategoryFilter(e.target.value as any)} className={selectClass}>
                <option value="">All Categories</option>
                {EQUIPMENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{getEquipmentGroupLabel(cat as any)}</option>)}
              </select>
            </div>

            <FilterTagInput label="Classification" field="classification" selectedValues={filters.classification} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
            <FilterTagInput label="Nomenclature" field="nomenclature" selectedValues={filters.nomenclature} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
            <FilterTagInput label="Brand" field="brand" selectedValues={filters.brand} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
            <FilterTagInput label="Model" field="model" selectedValues={filters.model} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
            <FilterTagInput label="ICS" field="ics" selectedValues={filters.ics} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
            <FilterTagInput label="PAR" field="par" selectedValues={filters.par} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
            <FilterTagInput label="Status" field="status" selectedValues={filters.status} onAdd={addFilter} onRemove={removeFilter} getSuggestions={getSuggestions} />
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && !error && hasActiveFilters && (
        <div className="text-sm font-medium text-foreground-muted px-1">
          {items.length} items across {bowGroups.length} Vessel{bowGroups.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="  bg-surface p-3 shadow-card border border-foreground/10 text-center">
          <div className="text-foreground-muted">Loading inventory items...</div>
        </div>
      ) : error ? (
        <div className=" bg-error-bg p-3 shadow-card border border-error/20">
          <p className="text-error">{error}</p>
        </div>
      ) : bowGroups.length === 0 ? (
        <div className="  bg-surface p-3 shadow-card border border-foreground/10 text-center">
          <FileText className="w-8 h-8 text-foreground-muted mx-auto mb-4" />
          <p className="text-foreground-muted">No inventory items found</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-4 text-sm text-primary hover:underline">
              Clear filters to see all items
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {bowGroups.map(group => (
            <BowGroup
              key={group.bowNumber}
              bowNumber={group.bowNumber}
              className={group.className}
              items={group.items}
              hasReport={group.hasReport}
              reportDate={group.reportDate}
              basePath={role ? `/${role}` : ''}
            />
          ))}
          <div className="text-center text-sm text-foreground-muted py-4">
            End of result
          </div>
        </div>
      )}
    </div>
  )
}
