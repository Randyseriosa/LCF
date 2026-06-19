import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RecentMonthlyAttachmentImport {
    id: string
    vessel_id: string
    vessel_name: string
    bow_number: string
    report_month: string
    file_path: string
    filename: string
    created_at: string
}

export function useRecentMonthlyAttachmentImports(limit: number = 5) {
    const supabase = createClient()
    const [imports, setImports] = useState<RecentMonthlyAttachmentImport[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchImports = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error: fetchError } = await supabase
                .from('monthly_report_attachments')
                .select(`
                    id,
                    vessel_id,
                    report_month,
                    file_path,
                    filename,
                    created_at,
                    vessels!inner (
                        bow_number,
                        slug,
                        class_of_vessel (
                            name
                        )
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (fetchError) throw fetchError

            const formattedImports: RecentMonthlyAttachmentImport[] = (data as any[] || []).map(item => {
                const vessel = Array.isArray(item.vessels) ? item.vessels[0] : item.vessels;
                const classOfVessel = Array.isArray(vessel?.class_of_vessel) ? vessel.class_of_vessel[0] : vessel?.class_of_vessel;

                return {
                    id: item.id,
                    vessel_id: item.vessel_id,
                    vessel_name: classOfVessel?.name || 'Unknown Class',
                    bow_number: vessel?.bow_number || vessel?.slug || 'Unknown',
                    report_month: item.report_month,
                    file_path: item.file_path,
                    filename: item.filename,
                    created_at: item.created_at
                };
            })

            setImports(formattedImports)
        } catch (err: any) {
            setError(err.message || 'Failed to fetch recent imports')
        } finally {
            setLoading(false)
        }
    }, [supabase, limit])

    useEffect(() => {
        fetchImports()
    }, [fetchImports])

    return { imports, loading, error, refresh: fetchImports }
}
