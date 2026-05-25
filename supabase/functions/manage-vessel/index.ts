import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  action: 'create' | 'update' | 'delete'
  id?: string
  class_of_vessel?: string
  bow_number?: string
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
    const { action, id, class_of_vessel, bow_number } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'create') {
      if (!class_of_vessel || !bow_number) return errorResponse('class_of_vessel and bow_number are required for create', 400)
      const slug = generateSlug(bow_number)
      const { error, data } = await supabaseAdmin.from('vessels').insert({ class_of_vessel, bow_number, slug }).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'update') {
      if (!id) return errorResponse('id is required for update', 400)
      const updates: any = {}
      if (class_of_vessel !== undefined) updates.class_of_vessel = class_of_vessel
      if (bow_number !== undefined) {
        updates.bow_number = bow_number
        updates.slug = generateSlug(bow_number)
      }
      if (Object.keys(updates).length === 0) return errorResponse('No fields to update', 400)
      const { error, data } = await supabaseAdmin.from('vessels').update(updates).eq('id', id).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'delete') {
      if (!id) return errorResponse('id is required for delete', 400)
      const { error, data } = await supabaseAdmin.from('vessels').delete().eq('id', id).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
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
  if (message.includes('vessels_slug_key')) {
    return 'Bow number already exists'
  }
  if (message.includes('vessel_item_assignments_vessel_id_fkey')) {
    return 'Cannot delete this bow number because it has assigned items'
  }
  if (message.includes('duplicate key')) {
    return 'Duplicate entry detected'
  }
  return message
}

function successResponse(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
