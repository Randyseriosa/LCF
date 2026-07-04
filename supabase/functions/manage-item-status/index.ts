// @ts-nocheck
/// <reference path="../deno.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "../_shared/jwt.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-custom-auth, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('X-Custom-Auth') || req.headers.get('Authorization')
        console.log('Received Auth Header (Custom):', req.headers.get('X-Custom-Auth') ? 'PRESENT' : 'NONE')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const token = authHeader.replace('Bearer ', '')
        const jwtPayload = await verifyToken(token)
        console.log('JWT Verification result:', jwtPayload ? 'SUCCESS' : 'FAILED')

        if (!jwtPayload) {
            console.log('JWT Verification failed. Token length:', token.length)
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                details: 'Invalid or expired token',
                debug: { header_present: !!authHeader, token_len: token.length }
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!['admin', 'encoder'].includes(jwtPayload.role) || jwtPayload.is_active !== 'active') {
            return new Response(JSON.stringify({ error: 'Forbidden: Active admin or encoder role required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { itemId, is_status } = await req.json()

        if (!itemId || !is_status) {
            throw new Error('itemId and is_status are required')
        }

        if (!['active', 'retired'].includes(is_status)) {
            throw new Error('Invalid is_status')
        }

        // Only admin role is allowed to revert items back to active status (revert unserviceable to unassigned)
        if (is_status === 'active' && jwtPayload.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Forbidden: Only admin can revert unserviceable items to unassigned' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const { data, error } = await supabaseClient
            .from('items')
            .update({ is_status })
            .eq('id', itemId)
            .select()
            .single()

        if (error) throw error

        return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
