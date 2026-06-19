/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateToken, verifyToken } from '../_shared/jwt.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { refresh_token } = await req.json()

        if (!refresh_token) {
            return errorResponse('Refresh token is required', 400)
        }

        // Verify the refresh token
        const payload = await verifyToken(refresh_token)
        if (!payload) {
            return errorResponse('Invalid or expired refresh token', 401)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Get current profile data
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, is_active')
            .eq('auth_user_id', payload.user_id)
            .single()

        if (profileError || !profile) {
            return errorResponse('User not found', 401)
        }

        if (profile.is_active !== 'active') {
            return errorResponse('Account is inactive', 403)
        }

        // Generate new tokens
        const accessToken = await generateToken({
            user_id: payload.user_id,
            username: payload.username,
            role: profile.role,
            is_active: profile.is_active,
        }, 3600) // 1 hour

        const newRefreshToken = await generateToken({
            user_id: payload.user_id,
            username: payload.username,
            role: profile.role,
            is_active: profile.is_active,
        }, 86400 * 7) // 7 days

        return new Response(JSON.stringify({
            access_token: accessToken,
            refresh_token: newRefreshToken,
            user: {
                id: payload.user_id,
                username: payload.username,
                role: profile.role,
                is_active: profile.is_active,
            }
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
    } catch (err) {
        console.error('Unexpected error:', err)
        return errorResponse('Internal server error', 500)
    }
})
