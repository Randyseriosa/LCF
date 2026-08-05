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
    const { vesselId, options } = body

    if (!vesselId || !options || (!options.report && !options.masterlist)) {
      return errorResponse('Valid vesselId and options (report or masterlist) are required', 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify vessel exists
    const { data: vessel } = await supabaseAdmin
      .from('vessels')
      .select('id, bow_number')
      .eq('id', vesselId)
      .single()

    if (!vessel) {
      return errorResponse('Vessel not found', 404)
    }

    let message = ''

    if (options.masterlist) {
      options.report = true // Automatically force clear associated reports if masterlist is selected
    }

    if (options.report) {
      // Find all reports for the vessel
      const { data: reports } = await supabaseAdmin
        .from('monthly_reports')
        .select('id')
        .eq('vessel_id', vesselId)

      if (reports && reports.length > 0) {
        const reportIds = reports.map((r: { id: string }) => r.id)
        await supabaseAdmin.from('monthly_report_items').delete().in('report_id', reportIds)
        await supabaseAdmin.from('monthly_reports').delete().in('id', reportIds)
      }
      message += 'Reports cleared. '
    }

    if (options.masterlist) {
      const { data: assignments } = await supabaseAdmin
        .from('vessel_item_assignments')
        .select('item_id')
        .eq('vessel_id', vesselId)

      if (assignments && assignments.length > 0) {
        const itemIds = assignments.map((a: { item_id: string }) => a.item_id)

        await supabaseAdmin.from('vessel_item_assignments').delete().eq('vessel_id', vesselId)

        await supabaseAdmin.from('items').delete().in('id', itemIds)
      }
      message += 'Masterlist cleared. '
    }

    return successResponse({ message: message.trim() })
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
