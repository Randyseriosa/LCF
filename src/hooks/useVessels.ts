import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Vessel {
    id: string
    bow_number: string | null
    slug: string
    class_of_vessel: {
        id: string
        name: string
    } | null
}

/**
 * Hook to fetch all vessels (excluding system vessels like HQ Inventory).
 */
export function useVessels() {
    const [vessels, setVessels] = useState<Vessel[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchVessels = useCallback(async () => {
        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            const { data, error: fetchError } = await supabase
                .from('vessels')
                .select(`
                    id,
                    bow_number,
                    slug,
                    class_of_vessel (
                        id,
                        name
                    )
                `)
                .neq('slug', 'hq-inventory')
                .order('bow_number', { ascending: true })

            if (fetchError) throw fetchError

            const formatted: Vessel[] = (data || []).map((v: any) => {
                let classOfVessel = null
                if (v.class_of_vessel) {
                    classOfVessel = Array.isArray(v.class_of_vessel)
                        ? v.class_of_vessel[0] ?? null
                        : v.class_of_vessel
                }
                return {
                    id: v.id,
                    bow_number: v.bow_number,
                    slug: v.slug,
                    class_of_vessel: classOfVessel,
                }
            })

            setVessels(formatted)
        } catch (err: any) {
            setError(err.message || 'Failed to fetch vessels')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchVessels()
    }, [fetchVessels])

    return { vessels, loading, error, refresh: fetchVessels }
}
