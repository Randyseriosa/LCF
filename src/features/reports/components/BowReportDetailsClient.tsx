'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useMonthlyReportItems, type MonthlyReportItem } from '@/hooks/useMonthlyReportItems'
import { useEquipments, type Equipment } from '@/features/equipment/hooks/useEquipments'
import { getCategoryFromEquipmentType, isAmmunitionsGroup, isAmmunitionGroup } from '@/features/equipment/utils/equipmentGroup'
import { ArrowLeft, AlertCircle, Package } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface BowReportDetailsClientProps {
  bowNumber: string
  month: number
  year: number
  basePath: string
  reportsPath: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const formatDateForDisplay = (dateString: string | null): string => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    return `${day}-${month}-${year}`
  } catch {
    return dateString
  }
}

export function BowReportDetailsClient({
  bowNumber,
  month: initialMonth,
  year: initialYear,
  basePath,
  reportsPath
}: BowReportDetailsClientProps) {
  const searchParams = useSearchParams()
  const currentMonth = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : initialMonth
  const currentYear = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : initialYear

  const { items, loading, error } = useMonthlyReportItems({ bowNumber, month: currentMonth, year: currentYear })
  const { equipments: equipmentList, loading: loadingEquipments } = useEquipments()

  // Create a map of unique_code -> equipment info
  const equipmentMap = useMemo(() => {
    const map: Record<string, Equipment> = {}
    equipmentList.forEach(equip => {
      if (equip.unique_code && equip.id) {
        map[equip.unique_code] = equip
      }
    })
    return map
  }, [equipmentList])

  // Get sorted equipment codes (longer first to match more specific prefixes)
  const sortedEquipmentCodes = useMemo(() => {
    return Object.keys(equipmentMap).sort((a, b) => b.length - a.length)
  }, [equipmentMap])

  // Group items by equipment code
  const groupedItems = useMemo(() => {
    if (items.length === 0) return {}

    const groups: Record<string, MonthlyReportItem[]> = {}

    items.forEach(item => {
      let matchedEquipmentCode: string | null = null

      // Match against equipment codes
      for (const equipCode of sortedEquipmentCodes) {
        if (item.unique_code.startsWith(equipCode)) {
          matchedEquipmentCode = equipCode
          break
        }
      }

      // If no match found, try extracting prefix from item unique code
      if (!matchedEquipmentCode) {
        const parts = item.unique_code.split('-')
        if (parts.length >= 1) {
          matchedEquipmentCode = parts[0]
        }
      }

      // Only add items that match an equipment code
      if (matchedEquipmentCode && matchedEquipmentCode !== 'Uncategorized') {
        if (!groups[matchedEquipmentCode]) {
          groups[matchedEquipmentCode] = []
        }
        groups[matchedEquipmentCode].push(item)
      }
    })

    return groups
  }, [items, sortedEquipmentCodes])

  // Sort equipment codes alphabetically for display
  const sortedGroupedEquipmentCodes = useMemo(() => {
    return Object.keys(groupedItems).sort()
  }, [groupedItems])

  // Check if an equipment group is ammunition
  const isEquipmentAmmunition = (equipmentCode: string): boolean => {
    const equipment = equipmentMap[equipmentCode]
    if (!equipment) return false
    return isAmmunitionGroup(equipment.equipment_type, equipment.unique_code, equipment.name)
  }

  const monthName = MONTHS[currentMonth]

  if (loading || loadingEquipments) {
    return (
      <div className="space-y-3">
        <div className=" border border-foreground/5  bg-surface p-3 shadow-card text-center">
          <div className="text-foreground-muted">Loading report items...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className=" border border-error/30 bg-error-bg p-3 shadow-card">
          <div className="flex items-center gap-2 text-error">
            <AlertCircle className="w-5 h-5" />
            <div>{error}</div>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className=" border border-foreground/5  bg-surface p-3 shadow-card text-center">
          <Package className="w-8 h-8 text-foreground-muted mx-auto mb-3" />
          <div className="text-foreground-muted">No items found for this report</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Title Card / Header */}
      <div className="relative bg-surface shadow-card border border-foreground/10 p-6 overflow-hidden mb-[10px]">
        {/* Generic Banner Background */}
        <div
          className="absolute inset-0 bg-cover bg-right bg-no-repeat z-0 opacity-60"
          style={{ backgroundImage: 'url(/images/banners/banner-general.webp)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-start gap-4">
          <Link
            href={reportsPath}
            className="flex items-center justify-center w-8 h-8 border border-foreground/10 bg-background/50 hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-all mt-0.5"
            title="Back to Bow Manifests"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[28px] font-black text-foreground uppercase tracking-tighter leading-none mb-2">
              {bowNumber}
            </h1>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 bg-primary animate-pulse" />
              <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em]">
                Monthly Report: {monthName} {currentYear} • {items.length} TOTAL ITEMS
              </p>
            </div>
          </div>
        </div>

        {/* Tactical Accent Bar */}
        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent z-10" />
      </div>

      {/* Items grouped by equipment */}
      <div className="overflow-hidden transition-all duration-300 ease-in-out max-h-[6000px] opacity-100">
        <div className="border-t border-foreground/10 bg-foreground/[0.02]">
          {sortedGroupedEquipmentCodes.map((equipmentCode) => {
            const equipment = equipmentMap[equipmentCode]
            const equipmentName = equipment?.name || equipmentCode
            const equipmentType = equipment?.equipment_type
            const isNavigational = equipmentType?.toLowerCase() === 'navigational'
            const isAmmunition = isEquipmentAmmunition(equipmentCode)

            return (
              <div key={equipmentCode} className="border-b border-foreground/10 last:border-b-0">
                <div className="px-10 py-2 bg-primary/5 border-b border-foreground/10 flex items-center gap-3">
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">{equipmentName}</span>
                  <span className="text-xs text-foreground-muted">{equipmentCode} · {groupedItems[equipmentCode].length} items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-foreground/[0.03]">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap pl-10">Unique Code</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Classification</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Nomenclature</th>
                        {isAmmunition ? (
                          <>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Prev Report</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Expended</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Replenished</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">On Hand</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Brand</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Model</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Serial No.</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Part No.</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Mfg Date</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Inst Date</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Last PMS</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Last Repair</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">ICS</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">PAR</th>
                            {isNavigational && (
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Hours</th>
                            )}
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">Status</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap w-48">Remarks</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/10">
                      {groupedItems[equipmentCode].map((item) => (
                        <tr key={item.id} className="hover:bg-foreground/[0.03] transition-colors">
                          <td className="px-4 py-2 text-xs text-foreground font-medium whitespace-nowrap pl-10">{item.unique_code || '-'}</td>
                          <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                          <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                          {isAmmunition ? (
                            <>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.previous_report ?? '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.expended ?? '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.replenished ?? '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.balance_on_hand ?? '-'}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateForDisplay(item.date_manufactured)}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateForDisplay(item.date_installed_issued)}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateForDisplay(item.date_last_pms)}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateForDisplay(item.date_last_repair)}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                              {isNavigational && (
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.running_hours || '-'}</td>
                              )}
                              <td className="px-4 py-2 text-xs whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-secondary/20 text-foreground">
                                  {item.status || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.remarks || '-'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
