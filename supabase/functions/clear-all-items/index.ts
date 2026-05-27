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
    const { filter } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let message = 'All items and assignments cleared successfully'

    if (filter === 'hq') {
      const hqPattern = '%-OLCF6-%'

      // Get IDs of HQ items first
      const { data: hqItems, error: fetchError } = await supabaseAdmin
        .from('items')
        .select('id')
        .ilike('unique_code', hqPattern)

      if (fetchError) {
        console.error('Error fetching HQ items:', fetchError)
        return errorResponse(`Failed to fetch HQ items: ${fetchError.message}`, 500)
      }

      if (hqItems && hqItems.length > 0) {
        const hqItemIds = hqItems.map((item: { id: string }) => item.id)

        // Delete assignments for HQ items
        const { error: assignmentsError } = await supabaseAdmin
          .from('vessel_item_assignments')
          .delete()
          .in('item_id', hqItemIds)

        if (assignmentsError) {
          console.error('Error deleting HQ vessel_item_assignments:', assignmentsError)
          return errorResponse(`Failed to delete HQ vessel_item_assignments: ${assignmentsError.message}`, 500)
        }

        // Delete HQ items
        const { error: itemsError } = await supabaseAdmin
          .from('items')
          .delete()
          .in('id', hqItemIds)

        if (itemsError) {
          console.error('Error deleting HQ items:', itemsError)
          return errorResponse(`Failed to delete HQ items: ${itemsError.message}`, 500)
        }

        message = `Successfully cleared ${hqItems.length} HQ items and their assignments`
      } else {
        message = 'No HQ items found to clear'
      }
    } else {
      // Original "Clear All" behavior
      // Delete all vessel_item_assignments first
      const { error: assignmentsError } = await supabaseAdmin
        .from('vessel_item_assignments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (assignmentsError) {
        console.error('Error deleting vessel_item_assignments:', assignmentsError)
        return errorResponse(`Failed to delete vessel_item_assignments: ${assignmentsError.message}`, 500)
      }

      // Delete all items
      const { error: itemsError } = await supabaseAdmin
        .from('items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (itemsError) {
        console.error('Error deleting items:', itemsError)
        return errorResponse(`Failed to delete items: ${itemsError.message}`, 500)
      }
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
