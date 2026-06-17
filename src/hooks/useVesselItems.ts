import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface VesselItem {
    id: string
    unique_code: string
    nomenclature: string | null
    serial_number: string | null
    classification: string | null
    status: string | null
    equipment_name: string
    equipment_code: string
    monthly_remarks: string | null
}

/**
 * Hook to fetch items assigned to a specific vessel.
 * Returns items joined through vessel_item_assignments with equipment info.
 */
export function useVesselItems(vesselId: string | null, period?: { month: number, year: number }) {
    const [items, setItems] = useState<VesselItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = useCallback(async () => {
        if (!vesselId) {
            setItems([])
            return
        }

        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            // Subquery equivalent: Get the remarks from monthly_report_items for the specific month/year
            // Since Supabase JS filters aren't ideal for deep joins with specific conditions on the leaf,
            // we'll fetch the items and their monthly remarks if period is provided.

            const startOfMonth = period
                ? `${period.year}-${String(period.month + 1).padStart(2, '0')}-01`
                : null

            let query = supabase
                .from('vessel_item_assignments')
                .select(`
                    items!vessel_item_assignments_item_id_fkey (
                        id,
                        unique_code,
                        nomenclature,
                        serial_number,
                        classification,
                        status,
                        equipments!inner (
                            name,
                            unique_code
                        ),
                        monthly_report_items (
                            remarks,
                            monthly_reports!inner (
                                report_month
                            )
                        )
                    )
                `)
                .eq('vessel_id', vesselId)
                .eq('is_current', true)

            if (startOfMonth) {
                query = query.eq('items.monthly_report_items.monthly_reports.report_month', startOfMonth)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError

            const formatted: VesselItem[] = (data || [])
                .map((assignment: any) => {
                    const item = assignment.items
                    if (!item || !item.unique_code) return null
                    return {
                        id: item.id,
                        unique_code: item.unique_code,
                        nomenclature: item.nomenclature,
                        serial_number: item.serial_number,
                        classification: item.classification,
                        status: item.status,
                        equipment_name: item.equipments?.name || 'Unknown',
                        equipment_code: item.equipments?.unique_code || 'Unknown',
                        monthly_remarks: item.monthly_report_items?.[0]?.remarks || null,
                    }
                })
                .filter(Boolean) as VesselItem[]

            // Sort by unique_code
            formatted.sort((a, b) => a.unique_code.localeCompare(b.unique_code))
            setItems(formatted)
        } catch (err: any) {
            setError(err.message || 'Failed to fetch vessel items')
        } finally {
            setLoading(false)
        }
    }, [vesselId, period?.month, period?.year])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    return { items, loading, error, refresh: fetchItems }
}
