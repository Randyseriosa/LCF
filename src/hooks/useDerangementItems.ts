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
export function useDerangementItems() {
    const [items, setItems] = useState<DerangementItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchDerangementItems = useCallback(async () => {
        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            const { data, error: fetchError } = await supabase
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
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            console.log('[useDerangementItems] Raw data:', data)

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

                        itemMap.set(key, {
                            id: row.id,
                            item_id: itemId,
                            unique_code: item.unique_code || 'NO-CODE',
                            nomenclature: item.nomenclature || '',
                            serial_number: item.serial_number || '',
                            status: item.status || '',
                            remarks: row.remarks || '',
                            vessel_id: vesselId,
                            vessel_bow: vessel?.bow_number || 'Unknown',
                            equipment_name: (Array.isArray(equipment) ? equipment[0] : equipment)?.name || 'Unknown',
                            report_count: 0,
                            report_month: row.report_month,
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
    }, [fetchDerangementItems])

    return { items, loading, error, refresh: fetchDerangementItems }
}

/**
 * Hook to fetch derangement reports for a specific item on a vessel.
 */
export function useItemDerangementReports(itemId: string | null, vesselId: string | null) {
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
            const { data, error: fetchError } = await supabase
                .from('derangement_reports')
                .select('id, filename, file_path, report_month, created_at')
                .eq('item_id', itemId)
                .eq('vessel_id', vesselId)
                .order('created_at', { ascending: false })

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
    }, [fetchReports])

    return { reports, loading, error, refresh: fetchReports }
}
