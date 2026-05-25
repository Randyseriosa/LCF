import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Item {
    id: string
    equipment_id: string
    unique_code?: string
    classification?: string
    nomenclature?: string
    brand?: string
    model?: string
    serial_number?: string
    part_number?: string
    date_manufactured?: string
    date_installed_issued?: string
    ics?: string
    par?: string
    quantity?: number | null
    is_spare?: string
    created_at: string
}

export function useEquipmentItems(equipmentId: string | null) {
    const supabase = createClient()
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = useCallback(async () => {
        if (!equipmentId) {
            setItems([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('equipment_id', equipmentId)
                .order('unique_code', { ascending: true })

            if (error) throw error
            setItems(data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load items')
        } finally {
            setLoading(false)
        }
    }, [supabase, equipmentId])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    return {
        items,
        loading,
        error,
        refresh: fetchItems
    }
}
