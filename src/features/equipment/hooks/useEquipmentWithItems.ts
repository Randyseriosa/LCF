import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Item {
    id: string
    equipment_id: string
    unique_code: string | null
    classification: string | null
    nomenclature: string | null
    brand: string | null
    model: string | null
    serial_number: string | null
    part_number: string | null
    date_manufactured: string | null
    date_installed_issued: string | null
    ics: string | null
    par: string | null
    quantity: number | null
    current_assignment_id: string | null
    created_at: string
}

export interface EquipmentWithItems {
    id: string
    name: string
    unique_code: string | null
    created_at: string
    items: Item[]
}

export interface VesselItemAssignment {
    id: string
    item_id: string
    vessel_id: string
    is_current: boolean
    assigned_at: string
    created_at: string
}

export interface AssignmentWithDetails extends VesselItemAssignment {
    item: Item
    assigned_by: {
        id: string
        name: string | null
        email: string
        role: string
    } | null
}

export function useEquipmentWithItems(vesselId?: string) {
    const supabase = createClient()
    const [equipments, setEquipments] = useState<EquipmentWithItems[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // Fetch all equipments
            const { data: equipmentData, error: equipmentError } = await supabase
                .from('equipments')
                .select('*')
                .order('name', { ascending: true })

            if (equipmentError) throw equipmentError

            let itemData

            if (vesselId) {
                // Fetch items assigned to this vessel via current_assignment_id
                const { data: itemsWithAssignments, error: itemError } = await supabase
                    .from('items')
                    .select('*, vessel_item_assignments!current_assignment_id(vessel_id)')
                    .eq('is_status', 'active')
                    .not('current_assignment_id', 'is', null)

                if (itemError) throw itemError

                // Filter items where the assignment's vessel_id matches
                itemData = (itemsWithAssignments || []).filter((item: any) => {
                    const assignment = item.vessel_item_assignments
                    return assignment && assignment.vessel_id === vesselId
                })
            } else {
                // Fetch all active items if no vesselId specified
                const { data: allItems, error: itemError } = await supabase
                    .from('items')
                    .select('*')
                    .eq('is_status', 'active')

                if (itemError) throw itemError
                itemData = allItems
            }

            // Group items by equipment
            const equipmentWithItems: EquipmentWithItems[] = (equipmentData || []).map(equipment => ({
                ...equipment,
                items: (itemData || [])
                    .filter(item => item.equipment_id === equipment.id)
                    .filter(item => item.nomenclature || item.unique_code)
            }))

            setEquipments(equipmentWithItems)
        } catch (err: any) {
            setError(err.message || 'Failed to load equipment with items')
        } finally {
            setLoading(false)
        }
    }, [supabase, vesselId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return {
        equipments,
        loading,
        error,
        refresh: fetchData
    }
}
