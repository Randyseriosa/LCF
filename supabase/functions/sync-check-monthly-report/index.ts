/// <reference path="../deno.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  report_id: string
}

/**
 * Authenticate user and verify role
 */
async function authenticateUser(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyToken(token)

  if (!payload) {
    return { error: 'Unauthorized', status: 401 }
  }

  if (!['admin', 'encoder', 'viewer'].includes(payload.role) || payload.is_active !== 'active') {
    return { error: 'Forbidden: Valid role required', status: 403 }
  }

  return { user_id: payload.user_id, role: payload.role }
}

/**
 * Compare two values for equality (handles null/undefined and string comparison)
 */
function valuesMatch(value1: string | null, value2: string | null): boolean {
  if (value1 === null && value2 === null) return true
  if (value1 === null || value2 === null) return false
  return String(value1).trim() === String(value2).trim()
}

/**
 * Get previous month's report for the same vessel
 */
async function getPreviousReport(
  supabaseAdmin: any,
  vesselId: string,
  currentReportMonth: string
): Promise<string | null> {
  const currentDate = new Date(currentReportMonth)
  const previousMonthDate = new Date(currentDate)
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
  
  const previousMonthStr = previousMonthDate.toISOString().slice(0, 7) + '-01'
  
  const { data: previousReport } = await supabaseAdmin
    .from('monthly_reports')
    .select('id')
    .eq('vessel_id', vesselId)
    .eq('report_month', previousMonthStr)
    .single()
  
  return previousReport?.id || null
}

/**
 * Perform sync check for monthly report items
 * Compares static columns with masterlist (for first month) or previous report
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const authResult = await authenticateUser(authHeader)
    
    if (authResult.error) {
      return errorResponse(authResult.error, authResult.status)
    }

    const body: Payload = await req.json()
    const { report_id } = body

    if (!report_id) {
      return errorResponse('report_id is required', 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the current report details
    const { data: currentReport, error: reportError } = await supabaseAdmin
      .from('monthly_reports')
      .select('id, vessel_id, report_month')
      .eq('id', report_id)
      .single()

    if (reportError || !currentReport) {
      return errorResponse('Report not found', 404)
    }

    // Get all items in the current report with equipment type
    const { data: reportItems, error: itemsError } = await supabaseAdmin
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
        items!monthly_report_items_item_id_fkey (
          equipments!inner (
            equipment_type
          )
        )
      `)
      .eq('report_id', report_id)

    if (itemsError) {
      return errorResponse('Failed to fetch report items', 500)
    }

    if (!reportItems || reportItems.length === 0) {
      return successResponse({ message: 'No items to sync check', updated: 0 })
    }

    // Check if there's a previous report
    const previousReportId = await getPreviousReport(
      supabaseAdmin,
      currentReport.vessel_id,
      currentReport.report_month
    )

    const updates: { id: string; sync_status: string }[] = []

    for (const reportItem of reportItems) {
      const equipmentType = reportItem.items?.equipments?.equipment_type
      const isAmmunition = equipmentType === 'ammunitions'

      let allMatched = true

      if (previousReportId) {
        // Compare with previous report
        const { data: previousItem } = await supabaseAdmin
          .from('monthly_report_items')
          .select(`
            classification,
            nomenclature,
            brand,
            model,
            serial_number,
            part_number,
            date_manufactured,
            date_installed_issued
          `)
          .eq('report_id', previousReportId)
          .eq('unique_code', reportItem.unique_code)
          .single()

        if (previousItem) {
          // Check relevant columns based on equipment type
          if (isAmmunition) {
            // For ammunition, only check these 3 columns
            if (!valuesMatch(reportItem.classification, previousItem.classification)) allMatched = false
            if (!valuesMatch(reportItem.nomenclature, previousItem.nomenclature)) allMatched = false
          } else {
            // For regular items, check all static columns
            if (!valuesMatch(reportItem.classification, previousItem.classification)) allMatched = false
            if (!valuesMatch(reportItem.nomenclature, previousItem.nomenclature)) allMatched = false
            if (!valuesMatch(reportItem.brand, previousItem.brand)) allMatched = false
            if (!valuesMatch(reportItem.model, previousItem.model)) allMatched = false
            if (!valuesMatch(reportItem.serial_number, previousItem.serial_number)) allMatched = false
            if (!valuesMatch(reportItem.part_number, previousItem.part_number)) allMatched = false
            if (!valuesMatch(reportItem.date_manufactured, previousItem.date_manufactured)) allMatched = false
            if (!valuesMatch(reportItem.date_installed_issued, previousItem.date_installed_issued)) allMatched = false
          }
        } else {
          // Item not in previous report, check against masterlist
          allMatched = false
        }
      } else {
        // No previous report, compare with masterlist (items table)
        const { data: masterItem } = await supabaseAdmin
          .from('items')
          .select(`
            classification,
            nomenclature,
            brand,
            model,
            serial_number,
            part_number,
            date_manufactured,
            date_installed_issued
          `)
          .eq('unique_code', reportItem.unique_code)
          .single()

        if (masterItem) {
          // Check relevant columns based on equipment type
          if (isAmmunition) {
            // For ammunition, only check these 3 columns
            if (!valuesMatch(reportItem.classification, masterItem.classification)) allMatched = false
            if (!valuesMatch(reportItem.nomenclature, masterItem.nomenclature)) allMatched = false
          } else {
            // For regular items, check all static columns
            if (!valuesMatch(reportItem.classification, masterItem.classification)) allMatched = false
            if (!valuesMatch(reportItem.nomenclature, masterItem.nomenclature)) allMatched = false
            if (!valuesMatch(reportItem.brand, masterItem.brand)) allMatched = false
            if (!valuesMatch(reportItem.model, masterItem.model)) allMatched = false
            if (!valuesMatch(reportItem.serial_number, masterItem.serial_number)) allMatched = false
            if (!valuesMatch(reportItem.part_number, masterItem.part_number)) allMatched = false
            if (!valuesMatch(reportItem.date_manufactured, masterItem.date_manufactured)) allMatched = false
            if (!valuesMatch(reportItem.date_installed_issued, masterItem.date_installed_issued)) allMatched = false
          }
        } else {
          // Item not in masterlist
          allMatched = false
        }
      }

      updates.push({
        id: reportItem.id,
        sync_status: allMatched ? 'matched' : 'mismatched'
      })
    }

    // Update sync_status in batches
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100)
      const { error: updateError } = await supabaseAdmin
        .from('monthly_report_items')
        .upsert(batch)

      if (updateError) {
        return errorResponse('Failed to update sync status: ' + updateError.message, 500)
      }
    }

    return successResponse({
      message: `Sync check completed for ${updates.length} items`,
      updated: updates.length,
      matched: updates.filter(u => u.sync_status === 'matched').length,
      mismatched: updates.filter(u => u.sync_status === 'mismatched').length
    })
  } catch (err) {
    return errorResponse('Internal server error: ' + (err as Error).message, 500)
  }
})

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function successResponse(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
