import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ClassOfVessel {
    id: string
    name: string
    sort_order: number
    created_at: string
}

/**
 * Lightweight read-only hook to fetch all classes of vessel.
 * Used on dashboards where full vessel management isn't needed.
 */
export function useClassesOfVessel() {
    const supabase = createClient()
    const [classesOfVessel, setClassesOfVessel] = useState<ClassOfVessel[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchClasses = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error: fetchError } = await supabase
                .from('class_of_vessel')
                .select('*')
                .order('sort_order', { ascending: true })

            if (fetchError) throw fetchError
            setClassesOfVessel(data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load vessel classes')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchClasses()
    }, [fetchClasses])

    return { classesOfVessel, loading, error, refresh: fetchClasses }
}
