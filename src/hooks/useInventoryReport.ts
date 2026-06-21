'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCategoryFromEquipmentType } from '@/features/equipment/utils/equipmentGroup'

export interface InventoryItem {
  id: string
  unique_code: string
  classification: string
  nomenclature: string
  brand: string
  model: string
  serial_number: string
  part_number: string
  date_manufactured: string | null
  date_installed_issued: string | null
  ics: string
  par: string
  date_last_pms: string | null
  date_last_repair: string | null
  running_hours: number | null
  status: string
  remarks: string
  previous_report: number | null
  expended: number | null
  replenished: number | null
  balance_on_hand: number | null
  quantity: number | null
  report_id: string
  items: {
    equipments: {
      id: string
      unique_code: string
      name: string
      equipment_type: string | null
    }
  }
  monthly_reports: {
    id?: string
    report_month: string | null
    created_at?: string
    vessels: {
      bow_number: string | null
      class_of_vessel: {
        name: string
      } | null
    } | null
  } | null
}

interface VesselMaster {
  id: string
  bow_number: string | null
  class_of_vessel: { name: string } | { name: string }[] | null
}

interface MasterlistItem {
  id: string
  unique_code: string
  classification: string
  nomenclature: string
  brand: string
  model: string
  serial_number: string
  part_number: string
  date_manufactured: string | null
  date_installed_issued: string | null
  ics: string
  par: string
  date_last_pms: string | null
  date_last_repair: string | null
  running_hours: number | null
  is_status: string
  remarks: string
  quantity: number | null
  items: {
    equipments: {
      id: string
      unique_code: string
      name: string
      equipment_type: string | null
    }
  }
}

function getVesselClassName(v: VesselMaster): string {
  if (!v.class_of_vessel) return ''
  if (Array.isArray(v.class_of_vessel)) return v.class_of_vessel[0]?.name ?? ''
  return v.class_of_vessel.name
}

export interface BowGroupData {
  bowNumber: string
  className: string
  items: InventoryItem[]
  hasReport: boolean
  reportDate: string | null
}

export const FILTER_FIELDS = ['classification', 'nomenclature', 'brand', 'model', 'ics', 'par', 'status'] as const
export type FilterField = typeof FILTER_FIELDS[number]

export const EQUIPMENT_CATEGORIES = ['AMMUNITIONS', 'WEAPONS', 'COMMUNICATION', 'NAVIGATIONAL', 'ICT'] as const
export type EquipmentCategoryFilter = typeof EQUIPMENT_CATEGORIES[number] | ''

export interface InventoryFilters {
  keyword: string
  classification: string[]
  nomenclature: string[]
  brand: string[]
  model: string[]
  ics: string[]
  par: string[]
  status: string[]
}

const EMPTY_FILTERS: InventoryFilters = {
  keyword: '',
  classification: [],
  nomenclature: [],
  brand: [],
  model: [],
  ics: [],
  par: [],
  status: [],
}

function matchesKeyword(item: InventoryItem, keyword: string): boolean {
  const kw = keyword.toLowerCase()
  return [
    item.unique_code,
    item.classification,
    item.nomenclature,
    item.brand,
    item.model,
    item.serial_number,
    item.part_number,
    item.date_manufactured,
    item.date_installed_issued,
    item.date_last_pms,
    item.date_last_repair,
    item.ics,
    item.par,
    item.status,
    item.remarks,
  ].some(v => v?.toLowerCase().includes(kw))
}

function applyFieldFilters(list: InventoryItem[], filters: InventoryFilters, excludeField?: FilterField): InventoryItem[] {
  return list.filter(item => {
    for (const field of FILTER_FIELDS) {
      if (field === excludeField) continue
      const selected = filters[field]
      if (!selected.length) continue
      const val = (item[field] as string | null) ?? ''
      if (!selected.some(s => val.toLowerCase() === s.toLowerCase())) return false
    }
    return true
  })
}

export function useInventoryReport() {
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_FILTERS)
  const [classFilter, setClassFilter] = useState<string[]>([])
  const [bowFilter, setBowFilter] = useState<string[]>([])
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState<EquipmentCategoryFilter>('')
  const [allVessels, setAllVessels] = useState<VesselMaster[]>([])
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([])
  const [masterlistItems, setMasterlistItems] = useState<MasterlistItem[]>([])

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const [itemsRes, vesselsRes, classesRes, masterlistRes] = await Promise.all([
        supabase
          .from('monthly_report_items')
          .select(`*, items(equipments(id, unique_code, name, equipment_type)), monthly_reports!report_id(id, report_month, created_at, vessels!vessel_id(bow_number, class_of_vessel(name)))`)
          .order('unique_code', { ascending: true }),
        supabase
          .from('vessels')
          .select('id, bow_number, class_of_vessel(name)')
          .order('bow_number', { ascending: true }),
        supabase
          .from('class_of_vessel')
          .select('id, name')
          .order('sort_order', { ascending: true }),
        supabase
          .from('vessel_item_assignments')
          .select('vessel_id, item_id, item_id!inner(*, equipments(id, unique_code, name, equipment_type))')
          .eq('is_current', true),
      ])
      if (itemsRes.error) {
        console.error('[useInventoryReport] items query error:', itemsRes.error)
        throw itemsRes.error
      }
      if (vesselsRes.error) {
        console.error('[useInventoryReport] vessels query error:', vesselsRes.error)
        throw vesselsRes.error
      }
      if (classesRes.error) {
        console.error('[useInventoryReport] classes query error:', classesRes.error)
        throw classesRes.error
      }
      if (masterlistRes.error) {
        console.error('[useInventoryReport] masterlist query error:', masterlistRes.error)
        throw masterlistRes.error
      }
      setAllClasses(classesRes.data || [])

      const itemsData = itemsRes.data as any[] || []

      // Filter to keep only items from the latest report for each vessel
      const latestReportByBow = new Map<string, { time: number; created_at: string; report_id: string }>()

      itemsData.forEach(item => {
        // Handle potential array or object from Supabase join
        const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
        const vessel = report?.vessels
        const bow = (vessel?.bow_number || '').trim().toUpperCase()
        const monthStr = report?.report_month
        const createdAt = report?.created_at || ''
        const reportId = item.report_id

        if (bow && monthStr && reportId) {
          const time = new Date(monthStr).getTime()
          const current = latestReportByBow.get(bow)
          if (!current || time > current.time || (time === current.time && createdAt > current.created_at)) {
            latestReportByBow.set(bow, { time, created_at: createdAt, report_id: reportId })
          }
        }
      })

      const filteredItems = itemsData.filter(item => {
        const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
        const vessel = report?.vessels
        const bow = (vessel?.bow_number || '').trim().toUpperCase()

        if (!bow) return true // Keep things without bow info

        const latest = latestReportByBow.get(bow)
        if (!latest) return true

        // Only keep if it belongs to the latest report identified for this bow
        return item.report_id === latest.report_id
      })

      setAllItems(filteredItems)
      setAllVessels(vesselsRes.data as VesselMaster[] || [])
      const flattenedMasterlist = (masterlistRes.data || []).flatMap((assignment: any) => {
        if (!assignment.item_id) return []
        return [{ ...assignment.item_id, vessel_id: assignment.vessel_id }]
      })
      setMasterlistItems(flattenedMasterlist as MasterlistItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory items')
      console.error('[useInventoryReport] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [])

  const availableClasses = useMemo(() => allClasses.map(c => c.name), [allClasses])

  const availableBows = useMemo(() => {
    return allVessels
      .filter(v => classFilter.length === 0 || classFilter.includes(getVesselClassName(v)))
      .map(v => v.bow_number)
      .filter((b): b is string => !!b)
      .sort()
  }, [allVessels, classFilter])

  // Unified list: monthly-report items + masterlist items for vessels that have NO report yet.
  // This ensures filter suggestions cover ALL data in the system, not just reported items.
  const allItemsUnified = useMemo((): InventoryItem[] => {
    const bowsWithAnyReport = new Set<string>()
    allItems.forEach(item => {
      const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
      const bow = (report?.vessels?.bow_number || '').trim().toUpperCase()
      if (bow) bowsWithAnyReport.add(bow)
    })
    const masterlistOnlyItems: InventoryItem[] = []
    allVessels.forEach(vessel => {
      const bow = (vessel.bow_number || '').trim().toUpperCase()
      if (!bow || bowsWithAnyReport.has(bow)) return
      const mlItems = masterlistItems.filter(m => (m as any).vessel_id === vessel.id)
      mlItems.forEach(item => {
        masterlistOnlyItems.push({
          ...item,
          previous_report: null,
          expended: null,
          replenished: null,
          balance_on_hand: null,
          report_id: '',
          status: '-',
          monthly_reports: {
            report_month: null,
            vessels: {
              bow_number: bow,
              class_of_vessel: Array.isArray(vessel.class_of_vessel)
                ? vessel.class_of_vessel[0] ?? null
                : vessel.class_of_vessel,
            },
          },
        })
      })
    })
    return [...allItems, ...masterlistOnlyItems]
  }, [allItems, allVessels, masterlistItems])

  const items = useMemo(() => {
    let result = allItemsUnified
    if (filters.keyword) result = result.filter(item => matchesKeyword(item, filters.keyword))
    if (classFilter.length > 0) result = result.filter(item => {
      const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
      return classFilter.includes(report?.vessels?.class_of_vessel?.name ?? '')
    })
    if (bowFilter.length > 0) result = result.filter(item => {
      const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
      const bow = (report?.vessels?.bow_number || '').trim().toUpperCase()
      return bowFilter.some(b => b.trim().toUpperCase() === bow)
    })
    if (equipmentCategoryFilter) {
      result = result.filter(item => {
        const equipmentType = item.items?.equipments?.equipment_type || null
        const uniqueCode = item.items?.equipments?.unique_code || item.unique_code || null
        const category = getCategoryFromEquipmentType(equipmentType, uniqueCode)
        return category === equipmentCategoryFilter
      })
    }
    return applyFieldFilters(result, filters)
  }, [allItemsUnified, filters, classFilter, bowFilter, equipmentCategoryFilter])

  const bowGroups = useMemo((): BowGroupData[] => {
    // Build bow → filtered items map from the unified filtered list
    const itemsByBow = new Map<string, InventoryItem[]>()
    const reportDateByBow = new Map<string, string | null>()
    items.forEach(item => {
      const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
      const bow = (report?.vessels?.bow_number || '').trim().toUpperCase()
      if (!bow) return
      if (!itemsByBow.has(bow)) itemsByBow.set(bow, [])
      itemsByBow.get(bow)!.push(item)
      if (!reportDateByBow.has(bow)) {
        const reportDate = report?.report_month
        if (reportDate) {
          const d = new Date(reportDate)
          if (!isNaN(d.getTime())) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            reportDateByBow.set(bow, `${months[d.getMonth()]} ${d.getFullYear()}`)
          }
        }
      }
    })
    const bowsWithAnyReport = new Set<string>()
    allItems.forEach(item => {
      const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
      const bow = (report?.vessels?.bow_number || '').trim().toUpperCase()
      if (bow) bowsWithAnyReport.add(bow)
    })
    const hasItemFilters = filters.keyword !== '' || FILTER_FIELDS.some(f => filters[f].length > 0) || !!equipmentCategoryFilter
    const filteredVessels = allVessels.filter(v => {
      if (classFilter.length > 0 && !classFilter.includes(getVesselClassName(v))) return false
      if (bowFilter.length > 0 && !bowFilter.includes(v.bow_number ?? '')) return false
      return true
    })
    return filteredVessels
      .map(v => {
        const bow = v.bow_number ?? 'Unknown'
        const cls = getVesselClassName(v)
        const hasReport = bowsWithAnyReport.has(bow)
        // For vessels with a report: use filtered report items from unified list
        // For vessels without a report: use unified list items (which already includes filtered masterlist data)
        const normalizedBow = bow.trim().toUpperCase()
        const vesselItems = itemsByBow.get(normalizedBow) ?? []
        if (hasItemFilters && vesselItems.length === 0) return null
        return {
          bowNumber: bow,
          className: cls,
          items: vesselItems,
          hasReport,
          reportDate: reportDateByBow.get(bow) ?? null,
        }
      })
      .filter((g): g is BowGroupData => g !== null)
      .sort((a, b) => a.bowNumber.localeCompare(b.bowNumber))
  }, [allVessels, allItems, items, masterlistItems, filters, classFilter, bowFilter, equipmentCategoryFilter])

  // Suggestions are narrowed by ALL currently active filters (class, bow, equipment category,
  // and the other field-level filters) so the dropdown only shows contextually valid options.
  const getSuggestions = useCallback((field: FilterField, inputValue: string): string[] => {
    // Start with the unified list and apply every active filter EXCEPT the one being edited
    let contextItems = allItemsUnified

    // Apply class filter
    if (classFilter.length > 0) {
      contextItems = contextItems.filter(item => {
        const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
        return classFilter.includes(report?.vessels?.class_of_vessel?.name ?? '')
      })
    }

    // Apply bow filter
    if (bowFilter.length > 0) {
      contextItems = contextItems.filter(item => {
        const report = Array.isArray(item.monthly_reports) ? item.monthly_reports[0] : item.monthly_reports
        const bow = (report?.vessels?.bow_number || '').trim().toUpperCase()
        return bowFilter.some(b => b.trim().toUpperCase() === bow)
      })
    }

    // Apply equipment category filter
    if (equipmentCategoryFilter) {
      contextItems = contextItems.filter(item => {
        const equipmentType = item.items?.equipments?.equipment_type || null
        const uniqueCode = item.items?.equipments?.unique_code || item.unique_code || null
        const category = getCategoryFromEquipmentType(equipmentType, uniqueCode)
        return category === equipmentCategoryFilter
      })
    }

    // Apply keyword filter
    if (filters.keyword) {
      contextItems = contextItems.filter(item => matchesKeyword(item, filters.keyword))
    }

    // Apply all other field-level filters, excluding the field currently being suggested
    contextItems = applyFieldFilters(contextItems, filters, field)

    const unique = [...new Set(
      contextItems.map(item => (item[field] as string | null) ?? '').filter(Boolean)
    )].sort()

    if (!inputValue) return unique.slice(0, 50)
    return unique.filter(v => v.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 50)
  }, [allItemsUnified, filters, classFilter, bowFilter, equipmentCategoryFilter])

  const addFilter = (field: FilterField, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field] : [...prev[field], value],
    }))
  }

  const removeFilter = (field: FilterField, value: string) => {
    setFilters(prev => ({ ...prev, [field]: prev[field].filter(v => v !== value) }))
  }

  const updateKeyword = (value: string) => setFilters(prev => ({ ...prev, keyword: value }))

  const toggleClassFilter = (value: string) => {
    setClassFilter(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      // Remove bow selections that no longer belong to any selected class
      if (next.length > 0) {
        const validBows = allVessels
          .filter(v => next.includes(getVesselClassName(v)))
          .map(v => v.bow_number)
          .filter((b): b is string => !!b)
        setBowFilter(prevBow => prevBow.filter(b => validBows.includes(b)))
      } else {
        // No class selected — all bows are valid, keep existing bow selection
      }
      return next
    })
  }

  // Keep updateClassFilter as a convenience for single-value consumers (sets exactly one class)
  const updateClassFilter = (value: string) => {
    setClassFilter(value ? [value] : [])
    setBowFilter([])
  }

  const toggleBowFilter = (value: string) => {
    setBowFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setClassFilter([])
    setBowFilter([])
    setEquipmentCategoryFilter('')
  }

  const hasActiveFilters = filters.keyword !== '' || FILTER_FIELDS.some(f => filters[f].length > 0) || classFilter.length > 0 || bowFilter.length > 0 || !!equipmentCategoryFilter

  const activeFilterCount = FILTER_FIELDS.reduce((acc, f) => acc + filters[f].length, 0) + (filters.keyword ? 1 : 0) + classFilter.length + bowFilter.length + (equipmentCategoryFilter ? 1 : 0)

  return {
    items,
    loading,
    error,
    totalCount: items.length,
    filters,
    addFilter,
    removeFilter,
    updateKeyword,
    clearFilters,
    refetch: fetchItems,
    getSuggestions,
    hasActiveFilters,
    activeFilterCount,
    classFilter,
    bowFilter,
    updateClassFilter,
    toggleClassFilter,
    toggleBowFilter,
    setBowFilter,
    equipmentCategoryFilter,
    setEquipmentCategoryFilter,
    availableClasses,
    availableBows,
    bowGroups,
  }
}
