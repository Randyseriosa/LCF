'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, FileText, Clock, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { InventoryItem } from '@/hooks/useInventoryReport'
import { getCategoryFromEquipmentType, getEquipmentGroupLabel, type EquipmentCategory } from '@/features/equipment/utils/equipmentGroup'

interface BowGroupProps {
  bowNumber: string
  className: string
  items: InventoryItem[]
  hasReport: boolean
  reportDate?: string | null
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return date
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${day}-${month}-${d.getFullYear()}`
  } catch {
    return date
  }
}

function getReportMonthYear(reportDate: string | null | undefined): { month: number; year: number } | null {
  if (!reportDate) return null
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const parts = reportDate.split(' ')
    if (parts.length !== 2) return null

    const monthIndex = months.indexOf(parts[0])
    const year = parseInt(parts[1])

    if (monthIndex === -1 || isNaN(year)) return null

    return { month: monthIndex, year }
  } catch {
    return null
  }
}

export default function BowGroup({ bowNumber, className, items, hasReport, reportDate }: BowGroupProps) {
  const [expanded, setExpanded] = useState(false)

  const reportPeriod = getReportMonthYear(reportDate)
  const detailUrl = reportPeriod
    ? `/encoder/reports/${encodeURIComponent(bowNumber)}?month=${reportPeriod.month}&year=${reportPeriod.year}`
    : `/encoder/reports/${encodeURIComponent(bowNumber)}`

  // Check if report is up to date (current month)
  const isUpToDate = useMemo(() => {
    if (!hasReport || !reportDate) return false
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Parse reportDate (format: "Jan 2025")
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const parts = reportDate.split(' ')
    if (parts.length !== 2) return false

    const reportMonthIndex = months.indexOf(parts[0])
    const reportYear = parseInt(parts[1])

    return reportMonthIndex === currentMonth && reportYear === currentYear
  }, [hasReport, reportDate])

  const groupedByCategory = items.reduce((acc, item) => {
    try {
      const equipmentType = item.items?.equipments?.equipment_type || null
      const uniqueCode = item.items?.equipments?.unique_code || item.unique_code || null
      const category = getCategoryFromEquipmentType(equipmentType, uniqueCode)
      if (!acc[category]) {
        acc[category] = { name: getEquipmentGroupLabel(category), type: category, items: [] }
      }
      acc[category].items.push(item)
      return acc
    } catch (err) {
      console.error('[BowGroup] Error categorizing item:', item, err)
      // Default to COMMUNICATION for items that fail categorization
      const category = 'COMMUNICATION'
      if (!acc[category]) {
        acc[category] = { name: getEquipmentGroupLabel(category), type: category, items: [] }
      }
      acc[category].items.push(item)
      return acc
    }
  }, {} as Record<EquipmentCategory, { name: string; type: EquipmentCategory; items: InventoryItem[] }>)

  const categoryEntries = Object.entries(groupedByCategory)

  return (
    <div className="space-y-4">
      {/* Vessel Header Card */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full  bg-surface shadow-card border border-foreground/10 overflow-hidden hover:shadow-md transition-shadow"
      >
        <div className="flex items-center px-5 py-4 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{bowNumber}</p>
                <div className="flex items-center gap-2">
                  {className && <p className="text-xs text-foreground-muted">{className}</p>}
                  <p className="text-xs">
                    {hasReport
                      ? isUpToDate
                        ? <span className="text-green-600 font-medium">• Up To Date</span>
                        : reportDate
                          ? `• Updated as of (${reportDate})`
                          : '• Updated from Report'
                      : '• Updated from Masterlist'}
                  </p>
                </div>
              </div>
            </div>
            <span className="text-xs text-foreground-muted shrink-0">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          </div>
          {expanded
            ? <ChevronDown className="w-5 h-5 text-primary shrink-0 ml-4 transition-transform duration-200" />
            : <ChevronRight className="w-5 h-5 text-primary shrink-0 ml-4 transition-transform duration-200" />
          }
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        {items.length === 0 && (
          <div className="  bg-surface shadow-card border border-foreground/10 px-5 py-3 flex items-center gap-3 text-foreground-muted">
            {hasReport ? (
              <><FileText className="w-4 h-4 shrink-0" /><span className="text-sm">No items match the current filters.</span></>
            ) : (
              <><Clock className="w-4 h-4 shrink-0" /><span className="text-sm">No monthly report submitted yet for this vessel.</span></>
            )}
          </div>
        )}

        {items.length > 0 && categoryEntries.map(([type, group]) => {
          const isAmmunitions = type === 'AMMUNITIONS'
          const isNavigational = type === 'NAVIGATIONAL'

          return (
            <div key={type} className="  bg-surface shadow-card border border-foreground/10 overflow-hidden">
              <div className="bg-foreground/5 px-4 py-2.5 border-b border-foreground/10">
                <h4 className="text-sm font-semibold text-foreground">{group.name}</h4>
                <p className="text-xs text-foreground-muted">{type} • {group.items.length} items</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-foreground/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Unique Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Classification</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Nomenclature</th>
                      {isAmmunitions && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">
                          {hasReport ? 'Balance on Hand' : 'Quantity'}
                        </th>
                      )}
                      {!isAmmunitions && (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Brand</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Model</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Serial Number</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Part Number</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date Manufactured</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date Installed</th>
                          {hasReport && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date of Last PMS</th>
                          )}
                          {hasReport && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date of Last Repair</th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">ICS</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">PAR</th>
                          {hasReport && isNavigational && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Running Hours</th>
                          )}
                        </>
                      )}
                      {hasReport && !isAmmunitions && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Status</th>
                      )}
                      {hasReport && !isAmmunitions && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Remarks</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/10">
                    {group.items.map((item) => {
                      try {
                        const equipmentType = item.items?.equipments?.equipment_type || null
                        const uniqueCode = item.items?.equipments?.unique_code || item.unique_code || null
                        const category = getCategoryFromEquipmentType(equipmentType, uniqueCode)

                        return (
                          <tr key={item.id} className="hover:bg-foreground/3 transition-colors">
                            <td className="px-4 py-2 text-xs text-foreground font-medium whitespace-nowrap">{item.unique_code || '-'}</td>
                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                            {isAmmunitions && (
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">
                                {hasReport ? (item.balance_on_hand ?? '-') : (item.quantity ?? '-')}
                              </td>
                            )}
                            {!isAmmunitions && (
                              <>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDate(item.date_manufactured)}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDate(item.date_installed_issued)}</td>
                                {hasReport && (
                                  <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDate(item.date_last_pms)}</td>
                                )}
                                {hasReport && (
                                  <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDate(item.date_last_repair)}</td>
                                )}
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                {hasReport && isNavigational && (
                                  <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.running_hours ?? '-'}</td>
                                )}
                              </>
                            )}
                            {hasReport && !isAmmunitions && (
                              <td className="px-4 py-2 text-xs whitespace-nowrap">
                                {item.status ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary/20 text-foreground">
                                    {item.status}
                                  </span>
                                ) : '-'}
                              </td>
                            )}
                            {hasReport && !isAmmunitions && (
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.remarks || '-'}</td>
                            )}
                          </tr>
                        )
                      } catch (err) {
                        console.error('[BowGroup] Error rendering item row:', item, err)
                        return (
                          <tr key={item.id} className="hover:bg-foreground/3 transition-colors">
                            <td className="px-4 py-2 text-xs text-foreground font-medium whitespace-nowrap">{item.unique_code || '-'}</td>
                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                            {isAmmunitions && (
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                            )}
                            {!isAmmunitions && (
                              <>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                {hasReport && (
                                  <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                )}
                                {hasReport && (
                                  <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                )}
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                {hasReport && isNavigational && (
                                  <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                                )}
                              </>
                            )}
                            {hasReport && !isAmmunitions && (
                              <td className="px-4 py-2 text-xs whitespace-nowrap">-</td>
                            )}
                            {hasReport && !isAmmunitions && (
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                            )}
                          </tr>
                        )
                      }
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
