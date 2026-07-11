import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MonthlyReportItem {
  id: string
  unique_code: string
  classification: string
  nomenclature: string
  brand: string
  model: string
  serial_number: string
  part_number: string
  date_manufactured: string | null
  date_installed_issued: string | null
  ics: string
  par: string
  date_last_pms: string | null
  date_last_repair: string | null
  running_hours: string | null
  status: string
  remarks: string
  previous_report: number | null
  expended: number | null
  replenished: number | null
  balance_on_hand: number | null
}

interface UseMonthlyReportItemsProps {
  bowNumber: string
  month: number
  year: number
}

/**
 * Hook to fetch monthly report items for a specific bow number and month/year
 */
export function useMonthlyReportItems({
  bowNumber,
  month,
  year
}: UseMonthlyReportItemsProps) {
  const supabase = createClient()
  const [items, setItems] = useState<MonthlyReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // First, get the vessel by bow number
      const { data: vessel, error: vesselError } = await supabase
        .from('vessels')
        .select('id')
        .eq('bow_number', bowNumber)
        .maybeSingle()

      if (vesselError || !vessel) {
        setError(`Vessel '${bowNumber}' not found. Please ask Admin to register this vessel first.`)
        setLoading(false)
        return
      }

      // Get the monthly report for this vessel and month/year
      // Use UTC methods to avoid timezone issues
      const reportDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const { data: report, error: reportError } = await supabase
        .from('monthly_reports')
        .select('id')
        .eq('vessel_id', vessel.id)
        .eq('report_month', reportDateStr)
        .single()

      if (reportError || !report) {
        setError('No report found for this vessel and month')
        setLoading(false)
        return
      }

      // Get all monthly report items for this report
      const { data: reportItems, error: itemsError } = await supabase
        .from('monthly_report_items')
        .select(`
          id,
          unique_code,
          classification,
          nomenclature,
          brand,
          model,
          serial_number,
          part_number,
          date_manufactured,
          date_installed_issued,
          ics,
          par,
          date_last_pms,
          date_last_repair,
          running_hours,
          status,
          remarks,
          previous_report,
          expended,
          replenished,
          balance_on_hand
        `)
        .eq('report_id', report.id)

      if (itemsError) throw itemsError

      setItems(reportItems || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load report items')
    } finally {
      setLoading(false)
    }
  }, [supabase, bowNumber, month, year])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return { items, loading, error, refresh: fetchItems }
}
