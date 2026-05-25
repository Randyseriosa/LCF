/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  action: 'generate-item-code' | 'validate-item-code'
  equipment_id: string
  vessel_id: string
  item_code?: string
}

// Validate item code format: TYPE_CODE-BOW_NUMBER-SEQUENCE (e.g., WE01-PS177-001)
function validateItemCode(code: string): boolean {
  // Pattern: 2 letters + 2 digits + hyphen + alphanumeric + hyphen + 3 digits
  // Examples: WE01-PS177-001, CE01-PS144-002, AM03-PG200-001
  const pattern = /^[A-Z]{2}\d{2}-[A-Z0-9]+-\d{3}$/
  return pattern.test(code)
}

// Generate sequential item code based on equipment type code and vessel bow number
async function generateItemCode(supabaseAdmin: any, equipmentId: string, vesselId: string): Promise<string> {
  // Fetch equipment unique_code
  const { data: equipment, error: equipmentError } = await supabaseAdmin
    .from('equipments')
    .select('unique_code')
    .eq('id', equipmentId)
    .single()
  
  if (equipmentError || !equipment?.unique_code) {
    throw new Error('Equipment not found or missing unique code')
  }
  
  // Fetch vessel bow_number
  const { data: vessel, error: vesselError } = await supabaseAdmin
    .from('vessels')
    .select('bow_number')
    .eq('id', vesselId)
    .single()
  
  if (vesselError || !vessel?.bow_number) {
    throw new Error('Vessel not found or missing bow number')
  }
  
  const equipmentTypeCode = equipment.unique_code
  const bowNumber = vessel.bow_number
  
  // Query items to find the highest sequential number for this equipment+vessel combination
  const { data: items, error } = await supabaseAdmin
    .from('items')
    .select('unique_code')
    .eq('equipment_id', equipmentId)
    .eq('vessel_id', vesselId)
    .like('unique_code', `${equipmentTypeCode}-${bowNumber}-%`)
    .order('unique_code', { ascending: false })
    .limit(1)
  
  if (error) {
    throw new Error(`Failed to query items: ${error.message}`)
  }
  
  let nextNumber = 1
  if (items && items.length > 0 && items[0].unique_code) {
    // Extract the sequential number from the last item code
    const parts = items[0].unique_code.split('-')
    const lastNumber = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }
  
  // Format as 3-digit number with leading zeros
  const sequentialNumber = nextNumber.toString().padStart(3, '0')
  return `${equipmentTypeCode}-${bowNumber}-${sequentialNumber}`
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
    const { action, equipment_id, vessel_id, item_code } = body

    if (!equipment_id || !vessel_id) {
      return errorResponse('equipment_id and vessel_id are required', 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'generate-item-code') {
      const itemCode = await generateItemCode(supabaseAdmin, equipment_id, vessel_id)
      return successResponse({ item_code: itemCode })
    } else if (action === 'validate-item-code') {
      if (!item_code) {
        return errorResponse('item_code is required for validation', 400)
      }
      
      const isValid = validateItemCode(item_code)
      
      // Check if item_code already exists
      const { data: existing } = await supabaseAdmin
        .from('items')
        .select('id')
        .eq('unique_code', item_code)
        .single()
      
      const isUnique = !existing
      
      return successResponse({
        valid: isValid,
        unique: isUnique,
        message: isValid
          ? (isUnique ? 'Valid item code' : 'Item code already exists')
          : 'Invalid item code format. Expected format: e.g., WE01-PS177-001'
      })
    }

    return errorResponse('Invalid action', 400)
  } catch (err) {
    console.error('Unexpected error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(errorMessage, 500)
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
