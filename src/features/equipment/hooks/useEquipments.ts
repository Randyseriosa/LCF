import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser } from '@/lib/auth'

export interface Equipment {
    id: string
    name: string
    unique_code?: string
    equipment_type?: string | null
    created_at: string
}

export function useEquipments() {
    const supabase = createClient()
    const [equipments, setEquipments] = useState<Equipment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('equipments')
                .select('*')
                .order('name', { ascending: true })

            if (error) throw error
            setEquipments(data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load equipments')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const manageEquipment = async (action: 'create' | 'update' | 'delete', payload: { id?: string, name?: string, unique_code?: string }) => {
        const user = await getAuthUser()
        if (!user) throw new Error('Not authenticated')

        const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
        const token = match ? decodeURIComponent(match[1]) : null
        if (!token) throw new Error('Not authenticated')

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-equipment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, ...payload })
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Operation failed')

        await fetchData()
        return data
    }

    return {
        equipments,
        loading,
        error,
        manageEquipment,
        refresh: fetchData
    }
}
