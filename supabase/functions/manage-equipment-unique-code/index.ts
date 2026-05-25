import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  action: 'validate' | 'update-unique-code'
  equipment_id?: string
  unique_code?: string
}

// Validate equipment type code pattern (e.g., WE, CE, NE, IE, AM)
function validateEquipmentUniqueCode(code: string): boolean {
  // Pattern: 2 letters only
  // Examples: WE (Weapon), CE (Communication), NE (Navigational), IE (ICT), AM (Ammunitions)
  const pattern = /^[A-Z]{2}$/
  return pattern.test(code)
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
    const { action, equipment_id, unique_code } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'validate') {
      if (!unique_code) {
        return errorResponse('unique_code is required for validation', 400)
      }
      const isValid = validateEquipmentUniqueCode(unique_code)
      
      // Check if unique_code already exists (exclude current equipment if updating)
      const { data: existing } = await supabaseAdmin
        .from('equipments')
        .select('id')
        .eq('unique_code', unique_code)
        .neq('id', equipment_id || '')
        .single()
      
      const isUnique = !existing
      
      return successResponse({
        valid: isValid,
        unique: isUnique,
        message: isValid
          ? (isUnique ? 'Valid unique code' : 'Unique code already exists')
          : 'Invalid unique code format. Expected format: e.g., WE, CE, NE, IE, AM'
      })
    } else if (action === 'update-unique-code') {
      if (!equipment_id || !unique_code) {
        return errorResponse('equipment_id and unique_code are required', 400)
      }
      
      if (!validateEquipmentUniqueCode(unique_code)) {
        return errorResponse('Invalid unique code format', 400)
      }
      
      // Check if unique_code already exists
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('equipments')
        .select('id')
        .eq('unique_code', unique_code)
        .neq('id', equipment_id)
        .single()
      
      if (existing) {
        return errorResponse('Unique code already exists', 400)
      }
      
      const { error, data } = await supabaseAdmin
        .from('equipments')
        .update({ unique_code })
        .eq('id', equipment_id)
        .select()
        .single()
      
      if (error) return errorResponse(error.message, 500)
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

function successResponse(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
