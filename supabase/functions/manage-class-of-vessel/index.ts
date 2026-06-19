/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  action: 'create' | 'update' | 'delete' | 'reorder'
  id?: string
  name?: string
  /** Array of { id, sort_order } for reorder action */
  items?: { id: string; sort_order: number }[]
}

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

    const body: Payload = await req.json()
    const { action, id, name, items } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'create') {
      if (!name) return errorResponse('name is required for create', 400)

      // Check for duplicate name
      const { data: existing } = await supabaseAdmin
        .from('class_of_vessel')
        .select('id')
        .eq('name', name)
        .single()

      if (existing) {
        return errorResponse('Class of vessel with this name already exists', 409)
      }

      // Get the current max sort_order and set the new one to max + 1
      const { data: maxRow } = await supabaseAdmin
        .from('class_of_vessel')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const nextSortOrder = (maxRow?.sort_order ?? 0) + 1

      const { error, data } = await supabaseAdmin
        .from('class_of_vessel')
        .insert({ name, sort_order: nextSortOrder })
        .select()
        .single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'update') {
      if (!id || !name) return errorResponse('id and name are required for update', 400)

      // Check for duplicate name (excluding current record)
      const { data: existing } = await supabaseAdmin
        .from('class_of_vessel')
        .select('id')
        .eq('name', name)
        .neq('id', id)
        .single()

      if (existing) {
        return errorResponse('Class of vessel with this name already exists', 409)
      }

      const { error, data } = await supabaseAdmin.from('class_of_vessel').update({ name }).eq('id', id).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'delete') {
      if (!id) return errorResponse('id is required for delete', 400)
      const { error, data } = await supabaseAdmin.from('class_of_vessel').delete().eq('id', id).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'reorder') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return errorResponse('items array is required for reorder', 400)
      }

      // Update each item's sort_order
      for (const item of items) {
        const { error } = await supabaseAdmin
          .from('class_of_vessel')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
        if (error) return errorResponse(error.message, 500)
      }

      return successResponse({ reordered: items.length })
    }

    return errorResponse('Invalid action', 400)
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

function getFriendlyErrorMessage(error: any): string {
  const message = error.message || ''
  if (message.includes('vessels_class_of_vessel_uuid_fkey')) {
    return 'Cannot delete this class of vessel because it has bow numbers assigned to it'
  }
  if (message.includes('foreign key constraint')) {
    return 'Cannot delete this item because it is referenced by other records'
  }
  if (message.includes('class_of_vessel_name_unique')) {
    return 'Class of vessel with this name already exists'
  }
  return message
}

function successResponse(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
