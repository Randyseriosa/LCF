import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RecentDerangementImport {
    id: string
    report_month: string
    created_at: string
    vessel_name: string
    importer_name: string
    filename: string
    file_path: string
}

export function useRecentDerangementImports(limit: number = 5) {
    const [imports, setImports] = useState<RecentDerangementImport[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchRecentImports = useCallback(async () => {
        const supabase = createClient()
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('derangement_reports')
                .select(`
                    id,
                    report_month,
                    created_at,
                    filename,
                    file_path,
                    vessels:vessel_id (bow_number),
                    profiles:imported_by (username, name)
                `)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) {
                console.error('[useRecentDerangementImports] Supabase error:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                })
                throw error
            }

            const formattedData = (data || []).map((item: any) => ({
                id: item.id,
                report_month: item.report_month,
                created_at: item.created_at,
                filename: item.filename,
                file_path: item.file_path,
                vessel_name: item.vessels?.bow_number || 'Unknown',
                importer_name: item.profiles?.name || item.profiles?.username || 'Unknown'
            }))

            setImports(formattedData)
        } catch (err: any) {
            console.error('[useRecentDerangementImports] Error fetching recent imports:', err)
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
