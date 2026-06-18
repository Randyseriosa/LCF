import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface DerangementItem {
    id: string
    item_id: string
    unique_code: string
    nomenclature: string
    serial_number: string
    status: string
    remarks: string
    vessel_id: string
    vessel_bow: string
    equipment_name: string
    report_count: number
    report_month: string
    file_path?: string
    filename?: string
    created_at: string
}

export interface DerangementReport {
    id: string
    filename: string
    file_path: string
    report_month: string
    created_at: string
}

/**
 * Hook to fetch items that have derangement reports.
 * Groups by vessel and returns item-level data with report counts.
 */
export function useDerangementItems(filter?: { month: number, year: number }) {
    const [items, setItems] = useState<DerangementItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchDerangementItems = useCallback(async () => {
        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            let query = supabase
                .from('derangement_reports')
                .select(`
                    *,
                    items (
                        *,
                        equipments (
                            *
                        )
                    ),
                    vessels (
                        bow_number
                    )
                `)

            if (filter) {
                const reportMonth = `${filter.year}-${String(filter.month + 1).padStart(2, '0')}-01`
                query = query.eq('report_month', reportMonth)
            }

            const { data, error: fetchError } = await query.order('created_at', { ascending: false })

            if (fetchError) throw fetchError


            // Collect unique item_id + vessel_id + report_month combos to fetch monthly_report_items status
            const monthlyStatusMap = new Map<string, string>()
            const uniqueLookups = new Set<string>()
                ; (data || []).forEach((row: any) => {
                    const item = row.items || row.item
                    if (!item) return
                    const vessel = row.vessels || row.vessel
                    const vesselId = row.vessel_id || vessel?.id
                    const itemId = item.id || row.item_id
                    if (vesselId && itemId && row.report_month) {
                        uniqueLookups.add(`${itemId}|${vesselId}|${row.report_month}`)
                    }
                })

            // Fetch monthly_report_items statuses in one query
            if (uniqueLookups.size > 0) {
                const itemIds = [...new Set([...uniqueLookups].map(k => k.split('|')[0]))]
                const { data: mriData } = await supabase
                    .from('monthly_report_items')
                    .select('item_id, status, monthly_reports!inner(vessel_id, report_month)')
                    .in('item_id', itemIds)

                    ; (mriData || []).forEach((mri: any) => {
                        const report = mri.monthly_reports
                        if (mri.item_id && report?.vessel_id && report?.report_month) {
                            // Normalize report_month to date-only string for key matching
                            const monthKey = String(report.report_month).substring(0, 10)
                            const key = `${mri.item_id}|${report.vessel_id}|${monthKey}`
                            monthlyStatusMap.set(key, mri.status || '')
                        }
                    })
            }

            // Group by vessel + item to aggregate report counts
            const itemMap = new Map<string, DerangementItem>()
            const reportsByItem = new Map<string, number>()

                ; (data || []).forEach((row: any) => {
                    const item = row.items || row.item
                    if (!item) return

                    const vessel = row.vessels || row.vessel
                    const vesselId = row.vessel_id || vessel?.id
                    const itemId = item.id || row.item_id

                    if (!vesselId || !itemId) return

                    const key = `${vesselId}-${itemId}`
                    const count = reportsByItem.get(key) || 0
                    reportsByItem.set(key, count + 1)

                    if (!itemMap.has(key)) {
                        const equipment = item.equipments || item.equipment

                        // Get status from monthly_report_items (e.g. "Operating") instead of items.is_status ("Active")
                        const reportMonthKey = row.report_month ? String(row.report_month).substring(0, 10) : ''
                        const mriLookupKey = `${itemId}|${vesselId}|${reportMonthKey}`
                        const mriStatus = monthlyStatusMap.get(mriLookupKey) || ''

                        itemMap.set(key, {
                            id: row.id,
                            item_id: itemId,
                            unique_code: item.unique_code || 'NO-CODE',
                            nomenclature: item.nomenclature || '',
                            serial_number: item.serial_number || '',
                            status: mriStatus,
                            remarks: row.remarks || '',
                            vessel_id: vesselId,
                            vessel_bow: vessel?.bow_number || 'Unknown',
                            equipment_name: (Array.isArray(equipment) ? equipment[0] : equipment)?.name || 'Unknown',
                            report_count: 0,
                            report_month: row.report_month,
                            file_path: row.file_path,
                            filename: row.filename,
                            created_at: row.created_at,
                        })
                    }
                })

            const result: DerangementItem[] = []
            itemMap.forEach((item, key) => {
                item.report_count = reportsByItem.get(key) || 0
                result.push(item)
            })

            result.sort((a, b) => {
                const bowCompare = a.vessel_bow.localeCompare(b.vessel_bow)
                if (bowCompare !== 0) return bowCompare
                return a.unique_code.localeCompare(b.unique_code)
            })

            setItems(result)
        } catch (err: any) {
            console.error('[useDerangementItems] Error:', err)
            setError(err.message || 'Failed to fetch derangement items')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDerangementItems()
    }, [fetchDerangementItems, filter?.month, filter?.year])

    return { items, loading, error, refresh: fetchDerangementItems }
}

/**
 * Hook to fetch derangement reports for a specific item on a vessel.
 */
export function useItemDerangementReports(itemId: string | null, vesselId: string | null, filter?: { month: number, year: number }) {
    const [reports, setReports] = useState<DerangementReport[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchReports = useCallback(async () => {
        if (!itemId || !vesselId) {
            setReports([])
            return
        }

        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            let query = supabase
                .from('derangement_reports')
                .select('id, filename, file_path, report_month, created_at')
                .eq('item_id', itemId)
                .eq('vessel_id', vesselId)

            if (filter) {
                const reportMonth = `${filter.year}-${String(filter.month + 1).padStart(2, '0')}-01`
                query = query.eq('report_month', reportMonth)
            }

            const { data, error: fetchError } = await query.order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            setReports(data || [])
        } catch (err: any) {
            console.error('[useItemDerangementReports] Error:', err)
            setError(err.message || 'Failed to fetch reports')
        } finally {
            setLoading(false)
        }
    }, [itemId, vesselId])

    useEffect(() => {
        fetchReports()
    }, [fetchReports, filter?.month, filter?.year])

    return { reports, loading, error, refresh: fetchReports }
}
