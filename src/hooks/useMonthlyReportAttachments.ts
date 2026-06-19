import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MonthlyAttachment {
    id: string
    vessel_id: string
    report_month: string
    file_path: string
    filename: string
    created_at: string
    vessel: {
        bow_number: string | null
        class_of_vessel: {
            name: string
        } | null
    }
}

export function useMonthlyReportAttachments(options: { month: number; year: number }) {
    const [attachments, setAttachments] = useState<MonthlyAttachment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAttachments = useCallback(async () => {
        const supabase = createClient()
        setLoading(true)
        setError(null)

        try {
            const reportMonth = `${options.year}-${String(options.month + 1).padStart(2, '0')}-01`

            const { data, error: fetchError } = await supabase
                .from('monthly_report_attachments')
                .select(`
                    *,
                    vessel:vessels (
                        bow_number,
                        class_of_vessel (
                            name
                        )
                    )
                `)
                .eq('report_month', reportMonth)
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            setAttachments(data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to fetch attachments')
        } finally {
            setLoading(false)
        }
    }, [options.month, options.year])

    useEffect(() => {
        fetchAttachments()
    }, [fetchAttachments])

    return { attachments, loading, error, refresh: fetchAttachments }
}
