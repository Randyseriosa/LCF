/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Missing authorization header', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const jwtPayload = await verifyToken(token)

    if (!jwtPayload) {
      return errorResponse('Unauthorized', 401)
    }
    if (!['admin', 'encoder'].includes(jwtPayload.role) || jwtPayload.is_active !== 'active') {
      return errorResponse('Forbidden: Active admin or encoder role required', 403)
    }

    const body = await req.json().catch(() => ({}))
    const { vesselSlug, month, year } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // If no parameters are provided, clear ALL monthly reports
    if (!vesselSlug && month === undefined && year === undefined) {
      console.log('Clearing ALL monthly reports...')

      // Delete all monthly report items first (though cascade should handle it)
      await supabaseAdmin
        .from('monthly_report_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      const { error: deleteAllError } = await supabaseAdmin
        .from('monthly_reports')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (deleteAllError) {
        console.error('Error clearing all reports:', deleteAllError)
        return errorResponse(`Failed to clear all reports: ${deleteAllError.message}`, 500)
      }

      return successResponse({
        message: 'All monthly reports cleared successfully',
        deleted: true
      })
    }

    if (!vesselSlug || month === undefined || year === undefined) {
      return errorResponse('vesselSlug, month, and year are required for single report clearing', 400)
    }

    // 1. Get Vessel ID
    const { data: vessel } = await supabaseAdmin
      .from('vessels')
      .select('id, bow_number')
      .eq('slug', vesselSlug)
      .single()

    if (!vessel) {
      return errorResponse(`Vessel ${vesselSlug} not found`, 404)
    }

    const reportMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`

    // 2. Find and Delete the report
    const { data: report } = await supabaseAdmin
      .from('monthly_reports')
      .select('id')
      .eq('vessel_id', vessel.id)
      .eq('report_month', reportMonth)
      .single()

    if (!report) {
      return successResponse({ message: 'No report found for this period', deleted: false })
    }

    // Delete report (cascades to monthly_report_items)
    const { error: deleteError } = await supabaseAdmin
      .from('monthly_reports')
      .delete()
      .eq('id', report.id)

    if (deleteError) {
      console.error('Error deleting report:', deleteError)
      return errorResponse(`Failed to delete report: ${deleteError.message}`, 500)
    }

    return successResponse({
      message: `Successfully cleared report for ${vessel.bow_number || vesselSlug} for ${reportMonth}`,
      deleted: true
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse('Internal server error', 500)
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
