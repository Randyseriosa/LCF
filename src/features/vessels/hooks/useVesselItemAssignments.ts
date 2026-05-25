import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/features/equipment/hooks/useEquipmentWithItems'

export interface ItemWithAssignment extends Item {
    assignment_id: string | null
    assigned_vessel_id: string | null
    assigned_vessel_name: string
}

export function useVesselItemAssignments(vesselId: string | null, equipmentId: string | null) {
    const supabase = createClient()
    const [items, setItems] = useState<ItemWithAssignment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAssignments = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // Fetch ALL items for the specific equipment (both assigned and unassigned)
            let query = supabase
                .from('items')
                .select('*')

            if (equipmentId) {
                query = query.eq('equipment_id', equipmentId)
            }

            const { data: itemData, error: itemError } = await query

            if (itemError) throw itemError

            const allItems = itemData || []

            // Initialize maps
            const thisVesselAssignmentMap = new Map<string, string>()
            const otherVesselMap = new Map<string, string>()

            if (vesselId && allItems.length > 0) {
                const itemIds = allItems.map((item: any) => item.id)

                // Fetch assignments for this vessel
                const { data: assignmentData } = await supabase
                    .from('vessel_item_assignments')
                    .select('item_id, id')
                    .eq('vessel_id', vesselId)
                    .eq('is_current', true)
                    .in('item_id', itemIds)

                // Map items assigned to this vessel
                if (assignmentData) {
                    assignmentData.forEach(a => {
                        thisVesselAssignmentMap.set(a.item_id, a.id)
                    })
                }

                // Fetch vessel names for items assigned to other vessels
                const itemsWithOtherAssignments = allItems.filter((item: any) => 
                    item.current_assignment_id && !thisVesselAssignmentMap.has(item.id)
                )

                if (itemsWithOtherAssignments.length > 0) {
                    const { data: otherAssignments } = await supabase
                        .from('vessel_item_assignments')
                        .select('item_id, vessel_id')
                        .eq('is_current', true)
                        .in('item_id', itemsWithOtherAssignments.map(i => i.id))

                    if (otherAssignments) {
                        const vesselIds = [...new Set(otherAssignments.map(a => a.vessel_id))]
                        const { data: vessels } = await supabase
                            .from('vessels')
                            .select('id, bow_number')
                            .in('id', vesselIds)

                        const vesselNameMap = new Map(
                            (vessels || []).map(v => [v.id, v.bow_number])
                        )

                        otherAssignments.forEach(a => {
                            const vesselName = vesselNameMap.get(a.vessel_id) ?? 'Unknown Vessel'
                            otherVesselMap.set(a.item_id, vesselName)
                        })
                    }
                }
            }

            // Merge assignment data with items
            const itemsWithAssignments: ItemWithAssignment[] = allItems.map((item: any) => {
                const thisVesselAssignmentId = thisVesselAssignmentMap.get(item.id)
                const otherVesselName = otherVesselMap.get(item.id)

                return {
                    ...item,
                    assignment_id: thisVesselAssignmentId || null,
                    assigned_vessel_id: thisVesselAssignmentId ? vesselId : null,
                    assigned_vessel_name: otherVesselName || ''
                }
            })

            setItems(itemsWithAssignments)
        } catch (err: any) {
            setError(err.message || 'Failed to load items')
        } finally {
            setLoading(false)
        }
    }, [vesselId, equipmentId, supabase])

    useEffect(() => {
        fetchAssignments()
    }, [fetchAssignments])

    return {
        items,
        loading,
        error,
        refresh: fetchAssignments
    }
}
