import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface VesselWithReportStatus {
    id: string
    bow_number: string | null
    class_of_vessel: {
        id: string
        name: string
    } | null
    slug: string
    submitted: boolean
    report_id: string | null
}

interface UseVesselsWithReportStatusProps {
    month?: number
    year?: number
    classOfVesselId?: string | null
    bowNumberFilter?: string | null
    submittedStatus?: 'submitted' | 'not-submitted' | 'all'
}

/**
 * Hook to fetch vessels with their monthly report submission status
 */
export function useVesselsWithReportStatus({
    month,
    year,
    classOfVesselId,
    bowNumberFilter,
    submittedStatus = 'all'
}: UseVesselsWithReportStatusProps = {}) {
    const supabase = createClient()
    const [vessels, setVessels] = useState<VesselWithReportStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchVessels = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // Build the base query - exclude system vessels like HQ Inventory
            let query = supabase
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
                .order('class_of_vessel(name)', { ascending: true, nullsFirst: false })
                .order('bow_number', { ascending: true })

            // Apply class of vessel filter
            if (classOfVesselId) {
                query = query.eq('class_of_vessel', classOfVesselId)
            }

            const { data: vesselsData, error: vesselsError } = await query

            if (vesselsError) throw vesselsError
            console.log('Vessels Data:', vesselsData)

            // Fetch monthly reports for the specified month/year
            let reportQuery = supabase
                .from('monthly_reports')
                .select('id, vessel_id')

            if (month !== undefined && year !== undefined) {
                // Use UTC methods to avoid timezone issues
                const reportDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
                console.log('=== Report Query Debug ===')
                console.log('Month:', month, 'Year:', year)
                console.log('Report Date String:', reportDateStr)
                reportQuery = reportQuery.eq('report_month', reportDateStr)
            }

            const { data: reportsData, error: reportsError } = await reportQuery
            console.log('Reports Data:', reportsData)
            console.log('Reports Error:', reportsError)

            if (reportsError) throw reportsError

            // Create a set of vessel IDs that have submitted reports
            const submittedVesselIds = new Set(
                reportsData?.map(r => r.vessel_id) || []
            )
            const reportIdByVessel = new Map(
                reportsData?.map(r => [r.vessel_id, r.id]) || []
            )
            console.log('Submitted Vessel IDs:', Array.from(submittedVesselIds))
            console.log('Vessel IDs from vesselsData:', vesselsData?.map(v => v.id))

            // Combine vessel data with submission status
            const vesselsWithStatus: VesselWithReportStatus[] = (vesselsData || []).map(vessel => {
                // Handle class_of_vessel - it can be an array, object, or null
                let classOfVessel = null
                if (vessel.class_of_vessel) {
                    if (Array.isArray(vessel.class_of_vessel)) {
                        classOfVessel = vessel.class_of_vessel.length > 0 ? vessel.class_of_vessel[0] : null
                    } else {
                        classOfVessel = vessel.class_of_vessel
                    }
                }

                return {
                    id: vessel.id,
                    bow_number: vessel.bow_number,
                    class_of_vessel: classOfVessel,
                    slug: vessel.slug,
                    submitted: submittedVesselIds.has(vessel.id),
                    report_id: reportIdByVessel.get(vessel.id) || null
                }
            })

            // Apply filters
            let filteredVessels = vesselsWithStatus

            // Apply bow number filter
            if (bowNumberFilter) {
                const filterLower = bowNumberFilter.toLowerCase()
                filteredVessels = filteredVessels.filter(v =>
                    v.bow_number?.toLowerCase().includes(filterLower)
                )
            }

            // Apply submitted status filter
            if (submittedStatus === 'submitted') {
                filteredVessels = filteredVessels.filter(v => v.submitted)
            } else if (submittedStatus === 'not-submitted') {
                filteredVessels = filteredVessels.filter(v => !v.submitted)
            }

            setVessels(filteredVessels)
        } catch (err: any) {
            setError(err.message || 'Failed to load vessels')
        } finally {
            setLoading(false)
        }
    }, [supabase, month, year, classOfVesselId, bowNumberFilter, submittedStatus])

    useEffect(() => {
        fetchVessels()
    }, [fetchVessels])

    return { vessels, loading, error, refresh: fetchVessels }
}
