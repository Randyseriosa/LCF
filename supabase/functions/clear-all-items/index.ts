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

    // We no longer rely on a filter like 'hq' since 'Delete All Masterlist'
    // explicitly means clear EVERYTHING across the board for all items.

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let message = 'All masterlist items, assignments, and monthly reports cleared successfully'

    // To safely delete all elements without triggering PostgREST unconditionally missing filter issues:

    // 0. Delete all monthly reports
    const { data: reports } = await supabaseAdmin.from('monthly_reports').select('id')
    if (reports && reports.length > 0) {
      const reportIds = reports.map((r: { id: string }) => r.id)

      const BATCH_SIZE = 500
      for (let i = 0; i < reportIds.length; i += BATCH_SIZE) {
        const batch = reportIds.slice(i, i + BATCH_SIZE)
        await supabaseAdmin.from('monthly_report_items').delete().in('report_id', batch)
        await supabaseAdmin.from('monthly_reports').delete().in('id', batch)
      }
    }

    // 1. Delete all vessel_item_assignments
    const { data: assignments } = await supabaseAdmin.from('vessel_item_assignments').select('id')
    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map((a: { id: string }) => a.id)

      const BATCH_SIZE = 500
      for (let i = 0; i < assignmentIds.length; i += BATCH_SIZE) {
        const batch = assignmentIds.slice(i, i + BATCH_SIZE)
        await supabaseAdmin.from('vessel_item_assignments').delete().in('id', batch)
      }
    }

    // 2. Delete all items 
    // This wipes everything in the masterlist (HQ and deployed)
    const { data: items } = await supabaseAdmin.from('items').select('id')
    if (items && items.length > 0) {
      const itemIds = items.map((i: { id: string }) => i.id)

      const BATCH_SIZE = 500
      for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
        const batch = itemIds.slice(i, i + BATCH_SIZE)
        const { error: itemsError } = await supabaseAdmin.from('items').delete().in('id', batch)

        if (itemsError) {
          console.error('Error deleting items:', itemsError)
          return errorResponse(`Failed to delete items: ${itemsError.message}`, 500)
        }
      }
    } else {
      message = 'Masterlist is already empty (No items found)'
    }

    return successResponse({ message })
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
