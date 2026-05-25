import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

/**
 * TEMPORARY DEVELOPMENT FUNCTION
 * This function clears all monthly report data from the system.
 * DELETE THIS FUNCTION BEFORE PRODUCTION DEPLOYMENT.
 */
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

    // Delete all monthly report items first (due to foreign key constraint)
    const { error: itemsError } = await supabaseAdmin
      .from('monthly_report_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (itemsError) {
      console.error('Error deleting monthly report items:', itemsError)
      return errorResponse(`Failed to delete monthly report items: ${itemsError.message}`, 500)
    }

    // Delete all monthly reports
    const { error: reportsError } = await supabaseAdmin
      .from('monthly_reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (reportsError) {
      console.error('Error deleting monthly reports:', reportsError)
      return errorResponse(`Failed to delete monthly reports: ${reportsError.message}`, 500)
    }

    return successResponse({
      message: 'Successfully cleared all monthly report data',
      warning: 'This is a temporary development function. Remove before production deployment.'
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
