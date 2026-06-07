import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RecentImport {
    id: string
    report_month: string
    created_at: string
    vessel_name: string
    importer_name: string
}

export function useRecentImports(limit: number = 5) {
    const [imports, setImports] = useState<RecentImport[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchRecentImports = useCallback(async () => {
        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('monthly_reports')
                .select(`
                    id,
                    report_month,
                    created_at,
                    imported_by,
                    vessels (bow_number),
                    profiles:profiles!imported_by (username, name)
                `)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) {
                console.error('[useRecentImports] Supabase error:', error)
                throw error
            }

            const formattedData = (data || []).map((item: any) => ({
                id: item.id,
                report_month: item.report_month,
                created_at: item.created_at,
                vessel_name: item.vessels?.bow_number || 'Unknown',
                importer_name: item.profiles?.name || item.profiles?.username || 'Unknown'
            }))

            setImports(formattedData)
        } catch (err: any) {
            console.error('[useRecentImports] Error fetching recent imports:', err)
            setError(err.message || 'Failed to fetch recent imports')
        } finally {
            setLoading(false)
        }
    }, [limit])

    useEffect(() => {
        fetchRecentImports()
    }, [fetchRecentImports])

    return { imports, loading, error, refresh: fetchRecentImports }
}
