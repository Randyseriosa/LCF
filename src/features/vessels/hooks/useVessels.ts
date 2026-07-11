import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'

export interface ClassOfVessel {
    id: string
    name: string
    sort_order: number
    created_at: string
}

export interface Vessel {
    id: string
    class_of_vessel: string // UUID to class_of_vessel
    bow_number: string
    slug: string
    created_at: string
}

export interface Equipment {
    id: string
    name: string
    created_at: string
}

export function useVessels() {
    const supabase = createClient()
    const [classesOfVessel, setClassesOfVessel] = useState<ClassOfVessel[]>([])
    const [vessels, setVessels] = useState<Vessel[]>([])
    const [equipments, setEquipments] = useState<Equipment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [classesRes, vesselsRes, equipmentsRes] = await Promise.all([
                supabase.from('class_of_vessel').select('*').order('sort_order', { ascending: true }),
                supabase.from('vessels').select('*').order('created_at', { ascending: false }),
                supabase.from('equipments').select('*').order('name', { ascending: true })
            ])

            if (classesRes.error) throw classesRes.error
            if (vesselsRes.error) throw vesselsRes.error
            if (equipmentsRes.error) throw equipmentsRes.error

            setClassesOfVessel(classesRes.data || [])
            setVessels(vesselsRes.data || [])
            setEquipments(equipmentsRes.data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const manageClassOfVessel = async (action: 'create' | 'update' | 'delete', payload: { id?: string, name?: string }) => {
        const user = await getAuthUser()
        if (!user) throw new Error('Not authenticated')

        const token = await getValidAccessToken()
        if (!token) throw new Error('Not authenticated')

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-class-of-vessel`, {
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

    const reorderClassesOfVessel = async (items: { id: string; sort_order: number }[]) => {
        const user = await getAuthUser()
        if (!user) throw new Error('Not authenticated')

        const token = await getValidAccessToken()
        if (!token) throw new Error('Not authenticated')

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-class-of-vessel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'reorder', items })
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Reorder failed')

        await fetchData()
        return data
    }

    const manageVessel = async (action: 'create' | 'update' | 'delete', payload: { id?: string, class_of_vessel?: string, bow_number?: string }) => {
        const user = await getAuthUser()
        if (!user) throw new Error('Not authenticated')

        const token = await getValidAccessToken()
        if (!token) throw new Error('Not authenticated')

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-vessel`, {
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
        classesOfVessel,
        vessels,
        equipments,
        loading,
        error,
        manageClassOfVessel,
        reorderClassesOfVessel,
        manageVessel,
        refresh: fetchData
    }
}
