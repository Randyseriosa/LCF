import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MonthlyReportStatus {
    exists: boolean
    reportId: string | null
    importedBy: string | null
    createdAt: string | null
}

interface UseMonthlyReportStatusProps {
    vesselId?: string | null
    month?: number
    year?: number
}

/**
 * Hook to check if a monthly report has been submitted for a specific vessel and month/year
 * Queries the monthly_reports table using report_month field
 */
export function useMonthlyReportStatus({
    vesselId,
    month,
    year
}: UseMonthlyReportStatusProps = {}) {
    const supabase = createClient()
    const [status, setStatus] = useState<MonthlyReportStatus>({
        exists: false,
        reportId: null,
        importedBy: null,
        createdAt: null
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const checkReportStatus = useCallback(async () => {
        if (!vesselId || month === undefined || year === undefined) {
            setStatus({
                exists: false,
                reportId: null,
                importedBy: null,
                createdAt: null
            })
            return
        }

        setLoading(true)
        setError(null)
        try {
            // Build the report month date (first day of the month)
            // Use UTC methods to avoid timezone issues
            const reportDateStr = `${year}-${String(month).padStart(2, '0')}-01`

            console.log('[useMonthlyReportStatus] Querying for vessel_id:', vesselId, 'report_month:', reportDateStr)

            // Query monthly_reports for the specific vessel and month
            const { data, error } = await supabase
                .from('monthly_reports')
                .select('id, imported_by, created_at')
                .eq('vessel_id', vesselId)
                .eq('report_month', reportDateStr)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - report doesn't exist
                    setStatus({
                        exists: false,
                        reportId: null,
                        importedBy: null,
                        createdAt: null
                    })
                } else {
                    throw error
                }
            } else if (data) {
                setStatus({
                    exists: true,
                    reportId: data.id,
                    importedBy: data.imported_by,
                    createdAt: data.created_at
                })
            }
        } catch (err: any) {
            setError(err.message || 'Failed to check report status')
            setStatus({
                exists: false,
                reportId: null,
                importedBy: null,
                createdAt: null
            })
        } finally {
            setLoading(false)
        }
    }, [supabase, vesselId, month, year])

    useEffect(() => {
        checkReportStatus()
    }, [checkReportStatus])

    return { status, loading, error, refresh: checkReportStatus }
}
