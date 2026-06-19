/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  action: 'create' | 'update' | 'delete'
  id?: string
  equipment_id?: string
  name?: string
  unique_code?: string
  equipment_type?: string
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
    const payload = await verifyToken(token)

    if (!payload) {
      return errorResponse('Unauthorized', 401)
    }
    if (!['admin', 'encoder'].includes(payload.role) || payload.is_active !== 'active') {
      return errorResponse('Forbidden: Active admin or encoder role required', 403)
    }

    const body: Payload = await req.json()
    const { action, id, equipment_id, name, unique_code, equipment_type } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'create') {
      if (!name) return errorResponse('name is required for create', 400)
      const insertData: any = { name }
      if (unique_code !== undefined) insertData.unique_code = unique_code
      const { error, data } = await supabaseAdmin.from('equipments').insert(insertData).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'update') {
      const recordId = id || equipment_id
      if (!recordId) return errorResponse('id or equipment_id is required for update', 400)
      const updates: any = {}
      if (name !== undefined) updates.name = name
      if (unique_code !== undefined) updates.unique_code = unique_code
      if (equipment_type !== undefined) updates.equipment_type = equipment_type
      if (Object.keys(updates).length === 0) return errorResponse('No fields to update', 400)
      const { error, data } = await supabaseAdmin.from('equipments').update(updates).eq('id', recordId).select().single()
      if (error) return errorResponse(getFriendlyErrorMessage(error), 400)
      return successResponse(data)
    } else if (action === 'delete') {
      if (!id) return errorResponse('id is required for delete', 400)
      // Prevent deletion of pre-defined system equipments
      const { data: eqRecord } = await supabaseAdmin.from('equipments').select('is_predefined').eq('id', id).single()
      if (eqRecord?.is_predefined) {
        return errorResponse('Pre-defined system equipments cannot be deleted', 403)
      }
      const { error, data } = await supabaseAdmin.from('equipments').delete().eq('id', id).select().single()
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
  if (message.includes('idx_equipments_unique_code')) {
    return 'Equipment with this unique code already exists'
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
