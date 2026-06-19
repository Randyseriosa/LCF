/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

const ALLOWED_ROLES = ['admin', 'encoder', 'viewer'] as const
const ALLOWED_STATUSES = ['active', 'inactive'] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]
type AllowedStatus = (typeof ALLOWED_STATUSES)[number]

interface UpdatePayload {
    target_user_id: string
    role?: AllowedRole
    is_active?: AllowedStatus
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

        if (!jwtPayload) return errorResponse('Unauthorized', 401)
        if (jwtPayload.role !== 'admin' || jwtPayload.is_active !== 'active') {
            return errorResponse('Forbidden: Active admin role required', 403)
        }

        // Parse body
        const body: UpdatePayload = await req.json()
        const { target_user_id, role, is_active } = body

        if (!target_user_id) {
            return errorResponse('target_user_id is required', 400)
        }

        // Validate role if provided
        if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
            return errorResponse(`Invalid role: ${role}`, 400)
        }

        // Validate is_active if provided
        if (is_active !== undefined && !ALLOWED_STATUSES.includes(is_active)) {
            return errorResponse(`Invalid is_active value: ${is_active}`, 400)
        }

        // Build update payload
        const updates: Record<string, unknown> = {}
        if (role !== undefined) updates.role = role
        if (is_active !== undefined) updates.is_active = is_active

        if (Object.keys(updates).length === 0) {
            return errorResponse('No fields to update', 400)
        }

        // Use service role client for the actual mutation
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', target_user_id)

        if (updateError) {
            console.error('Update error:', updateError)
            return errorResponse('Failed to update profile', 500)
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
