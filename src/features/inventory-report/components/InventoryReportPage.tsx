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
import { exportInventoryToExcel } from '@/features/inventory-report/utils/exportInventoryExcel'



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
    dataSource, setDataSource,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
  } = useInventoryReport()
  const [showFilters, setShowFilters] = useState(false)

  const selectClass = 'w-full px-3 py-2.5 border border-foreground/10 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all'

  const handleExport = () => {
    if (bowGroups.length === 0) return

    let filename = 'Global_Inventory_Report.xlsx'

    if (dataSource === 'masterlist') {
      filename = 'Global_Inventory_Report_masterlist.xlsx'
    } else if (dataSource === 'latest') {
      const now = new Date()
      const month = now.toLocaleString('default', { month: 'long' })
      const year = now.getFullYear()
      filename = `Global_Inventory_Report_${month}_${year}.xlsx`
    } else if (dataSource === 'monthly') {
      const monthName = new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' })
      filename = `Global_Inventory_Report_Report Period_${monthName}_${selectedYear}.xlsx`
    }

    exportInventoryToExcel(bowGroups, filename, dataSource !== 'masterlist')
  }



  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Inventory View"
        description={`Total Vessels: ${bowGroups.length}`}
        Icon={FileText}
        bannerImage="/images/banners/banner-general-button.webp"
        actions={
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all border bg-white text-primary border-primary hover:bg-primary hover:text-white"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            Export Data
          </button>
        }
      />

      {/* Unified Card: Search + Filter + Table */}
      <div className="bg-surface shadow-card border border-foreground/10 overflow-hidden">

        {/* ── Unified Tactical Toolbar ── */}
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3 pb-3 border-b border-foreground/10">
            {/* Data Source Selection */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">Data Source</span>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value as any)}
                className="px-3 py-1.5 border border-primary/20 bg-background text-[11px] font-black uppercase tracking-wider text-primary focus:outline-none focus:ring-1 focus:ring-primary h-[33px] min-w-[150px]"
                style={{ borderRadius: '0px' }}
              >
                <option value="latest">UP TO DATE</option>
                <option value="masterlist">MASTERLIST</option>
                <option value="monthly">MONTHLY PERIOD</option>
              </select>
            </div>

            {/* Report Period (Conditional) */}
            {dataSource === 'monthly' && (
              <div className="flex flex-col gap-1.5 shrink-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">Report Period</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 border border-primary/20 bg-background text-[11px] font-black uppercase tracking-wider text-primary focus:outline-none focus:ring-1 focus:ring-primary h-[33px]"
                    style={{ borderRadius: '0px' }}
                  >
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                      <option key={m} value={m}>
                        {new Date(2000, parseInt(m) - 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1.5 border border-primary/20 bg-background text-[11px] font-black uppercase tracking-wider text-primary focus:outline-none focus:ring-1 focus:ring-primary h-[33px]"
                    style={{ borderRadius: '0px' }}
                  >
                    {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString()).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-[200px]">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">Search Items</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/60" />
                <input
                  type="text"
                  placeholder="SEARCH KEYWORD, CODE, NOMENCLATURE, BRAND, MODEL, ICS, PAR..."
                  value={filters.keyword}
                  onChange={(e) => updateKeyword(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-primary/20 bg-background text-[11px] uppercase placeholder:text-primary/30 text-primary focus:outline-none focus:ring-1 focus:ring-primary h-[33px]"
                  style={{ borderRadius: '0px' }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 h-[33px]">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 h-full transition-all shrink-0 text-[11px] font-black uppercase tracking-wider border ${showFilters ? 'bg-primary text-white border-primary' : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'}`}
                style={{ borderRadius: '0px' }}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary text-white text-[9px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 h-full text-error hover:bg-error/5 transition-all text-[11px] font-black uppercase tracking-wider border border-error/20"
                  style={{ borderRadius: '0px' }}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
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

          {/* Filter Fields panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-foreground/10">
              <MultiSelectDropdown
                label="Class of Vessels"
                options={availableClasses}
                selected={classFilter}
                onToggle={toggleClassFilter}
                emptyMessage="No classes available"
              />
              <MultiSelectDropdown
                label="Bows"
                options={availableBows}
                selected={bowFilter}
                onToggle={toggleBowFilter}
                disabled={availableBows.length === 0}
                emptyMessage="No bows available"
              />
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

        {/* ── Divider + Results ── */}
        <div className="border-t border-foreground/10">
          {loading ? (
            <div className="px-5 py-8 text-center text-foreground-muted text-sm">
              Loading inventory items...
            </div>
          ) : error ? (
            <div className="px-5 py-4 text-error text-sm">
              {error}
            </div>
          ) : bowGroups.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText className="w-8 h-8 text-foreground-muted mx-auto mb-3" />
              <p className="text-foreground-muted text-sm">No inventory items found</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 text-sm text-primary hover:underline">
                  Clear filters to see all items
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Active-filter summary row */}
              {hasActiveFilters && (
                <div className="px-5 py-2 bg-primary/5 border-b border-foreground/10 text-xs font-medium text-foreground-muted">
                  {items.length} items across {bowGroups.length} Vessel{bowGroups.length !== 1 ? 's' : ''}
                </div>
              )}

              {/* Column header */}
              <div className="flex items-center px-5 py-2.5 bg-foreground/5 border-b border-foreground/10 gap-3">
                <span className="w-4 shrink-0" />
                <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider flex-1 text-left">Vessel</span>
                <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider flex-1 text-left">Class</span>
                <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider flex-1 text-left">{dataSource === 'masterlist' ? 'Report Status' : 'Period'}</span>
                <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider flex-1 text-right">Items</span>
              </div>

              {bowGroups.map((group, idx) => (
                <BowGroup
                  key={group.bowNumber}
                  bowNumber={group.bowNumber}
                  className={group.className}
                  items={group.items}
                  hasReport={group.hasReport}
                  hasMasterlist={group.hasMasterlist}
                  reportDate={group.reportDate}
                  basePath={role ? `/${role}` : ''}
                  isFirst={idx === 0}
                  isLast={idx === bowGroups.length - 1}
                  targetMonth={dataSource === 'monthly' ? selectedMonth : undefined}
                  targetYear={dataSource === 'monthly' ? selectedYear : undefined}
                />
              ))}

              <div className="text-center text-xs text-foreground-muted py-3 border-t border-foreground/10 bg-foreground/[0.02]">
                {bowGroups.length} vessel{bowGroups.length !== 1 ? 's' : ''} listed
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
