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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Delete all vessel_item_assignments first (due to foreign key constraint)
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

    return successResponse({ message: 'All items and assignments cleared successfully' })
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
