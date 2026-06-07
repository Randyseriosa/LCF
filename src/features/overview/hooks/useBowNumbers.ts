import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BowNumber {
    id: string
    bow_number: string | null
    class_of_vessel: string
    created_at: string
}

/**
 * Read-only hook to fetch all vessels (bow numbers) belonging to a given class of vessel.
 */
export function useBowNumbers(classOfVesselId: string | null) {
    const supabase = createClient()
    const [bowNumbers, setBowNumbers] = useState<BowNumber[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchBowNumbers = useCallback(async () => {
        if (!classOfVesselId) {
            setBowNumbers([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        try {
            const { data, error: fetchError } = await supabase
                .from('vessels')
                .select('*')
                .eq('class_of_vessel', classOfVesselId)
                .order('bow_number', { ascending: true })

            if (fetchError) throw fetchError
            setBowNumbers(data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load bow numbers')
        } finally {
            setLoading(false)
        }
    }, [supabase, classOfVesselId])

    useEffect(() => {
        fetchBowNumbers()
    }, [fetchBowNumbers])

    return { bowNumbers, loading, error, refresh: fetchBowNumbers }
}
