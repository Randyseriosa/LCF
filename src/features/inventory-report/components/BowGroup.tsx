'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, FileText, Clock } from 'lucide-react'
import type { InventoryItem } from '@/hooks/useInventoryReport'
import { getCategoryFromEquipmentType, getEquipmentGroupLabel, type EquipmentCategory } from '@/features/equipment/utils/equipmentGroup'

interface BowGroupProps {
  bowNumber: string
  className: string
  items: InventoryItem[]
  hasReport: boolean
  hasMasterlist: boolean
  reportDate?: string | null
  basePath?: string
  isFirst?: boolean
  isLast?: boolean
  targetMonth?: string // "01" - "12"
  targetYear?: string
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
    const monthIndex = months.indexOf(parts[0]) // 0-11
    const year = parseInt(parts[1])
    if (monthIndex === -1 || isNaN(year)) return null
    return { month: monthIndex + 1, year } // 1-12
  } catch {
    return null
  }
}

export default function BowGroup({
  bowNumber,
  className,
  items,
  hasReport,
  hasMasterlist,
  reportDate,
  basePath = '/encoder',
  isFirst = false,
  isLast = false,
  targetMonth,
  targetYear
}: BowGroupProps) {
  const [expanded, setExpanded] = useState(false)

  // Determine target month/year for status logic
  const effectiveTargetMonth = targetMonth ? parseInt(targetMonth) : new Date().getMonth() + 1
  const effectiveTargetYear = targetYear ? parseInt(targetYear) : new Date().getFullYear()

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
    } catch {
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
    <>
      {/* Row — vessel header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left bg-surface hover:bg-primary/5 transition-colors ${!isFirst ? 'border-t border-foreground/10' : ''}`}
      >
        <div className="flex items-center px-5 py-3 gap-3">
          {/* Expand icon */}
          <span className="shrink-0 text-primary w-4">
            {expanded
              ? <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              : <ChevronRight className="w-4 h-4 transition-transform duration-200" />
            }
          </span>

          {/* Bow number */}
          <span className="text-sm font-semibold text-foreground flex-1 truncate">{bowNumber}</span>

          {/* Class */}
          <span className="text-xs text-foreground-muted flex-1 truncate">{className}</span>

          {/* Status badge */}
          <span className="text-xs flex-1 text-left">
            {hasReport ? (() => {
              const reportMY = getReportMonthYear(reportDate);
              if (!reportMY) return null;

              const isMatch = reportMY.month === effectiveTargetMonth && reportMY.year === effectiveTargetYear;
              const now = new Date();
              const isActuallyCurrentMonth = reportMY.month === (now.getMonth() + 1) && reportMY.year === now.getFullYear();

              if (isMatch) {
                const monthName = new Date(2000, effectiveTargetMonth - 1).toLocaleString('default', { month: 'long' });

                if (isActuallyCurrentMonth) {
                  return (
                    <span className="font-bold uppercase flex items-center whitespace-nowrap text-green-600">
                      ● Up to Date - {monthName}
                    </span>
                  );
                }

                return (
                  <span className="font-bold uppercase flex items-center whitespace-nowrap text-green-600">
                    ● {reportDate}
                  </span>
                );
              }

              // Orange for previous or non-matching report
              return (
                <span className="font-bold uppercase flex items-center whitespace-nowrap text-orange-500">
                  ● {reportDate}
                </span>
              );
            })() : hasMasterlist ? (
              <span className="text-foreground-muted uppercase">● Masterlist</span>
            ) : (
              <span className="text-foreground-muted uppercase">● No Masterlist imported yet</span>
            )}
          </span>

          {/* Item count */}
          <span className="text-xs text-foreground-muted flex-1 text-right">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[6000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="border-t border-foreground/10 bg-foreground/[0.02]">
          {items.length === 0 && (
            <div className="px-10 py-4 flex items-center gap-3 text-foreground-muted">
              {hasReport
                ? <><FileText className="w-4 h-4 shrink-0" /><span className="text-sm">No items match the current filters.</span></>
                : <><Clock className="w-4 h-4 shrink-0" /><span className="text-sm">No monthly report submitted yet for this vessel.</span></>
              }
            </div>
          )}

          {items.length > 0 && categoryEntries.map(([type, group]) => {
            const isAmmunitions = type === 'AMMUNITIONS'
            const isNavigational = type === 'NAVIGATIONAL'

            return (
              <div key={type} className="border-b border-foreground/10 last:border-b-0">
                {/* Category sub-header */}
                <div className="px-10 py-2 bg-primary/5 border-b border-foreground/10 flex items-center gap-3">
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">{group.name}</span>
                  <span className="text-xs text-foreground-muted">{type} · {group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-foreground/[0.03]">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap pl-10">Unique Code</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Classification</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Nomenclature</th>
                        {isAmmunitions && (
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">
                            {hasReport ? 'Balance on Hand' : 'Quantity'}
                          </th>
                        )}
                        {!isAmmunitions && (
                          <>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Brand</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Model</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Serial Number</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Part Number</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date Manufactured</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date Installed</th>
                            {hasReport && (
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date of Last PMS</th>
                            )}
                            {hasReport && (
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Date of Last Repair</th>
                            )}
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">ICS</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">PAR</th>
                            {hasReport && isNavigational && (
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Running Hours</th>
                            )}
                          </>
                        )}
                        {hasReport && !isAmmunitions && (
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Status</th>
                        )}
                        {hasReport && !isAmmunitions && (
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Remarks</th>
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
                            <tr key={item.id} className="hover:bg-foreground/[0.03] transition-colors">
                              <td className="px-4 py-2 text-xs text-foreground font-medium whitespace-nowrap pl-10">{item.unique_code || '-'}</td>
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
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-secondary/20 text-foreground">
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
                        } catch {
                          return (
                            <tr key={item.id} className="hover:bg-foreground/[0.03] transition-colors">
                              <td className="px-4 py-2 text-xs text-foreground font-medium whitespace-nowrap pl-10">{item.unique_code || '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">-</td>
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
    </>
  )
}
