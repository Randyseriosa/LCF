/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-authorization, x-client-info, apikey, content-type',
}

interface RequestPayload {
    id: string
}

async function authenticateUser(authHeader: string | null) {
    if (!authHeader) {
        return { error: 'Missing authorization header', status: 401 }
    }

    if (!authHeader.startsWith('Bearer ')) {
        return { error: 'Invalid authorization format. Expected "Bearer <token>"', status: 401 }
    }

    const token = authHeader.replace('Bearer ', '')
    const payload = await verifyToken(token)

    if (!payload) {
        return { error: 'Invalid or expired token', status: 401 }
    }

    // Role check: Admin or Encoder only
    if (!['admin', 'encoder'].includes(payload.role) || payload.is_active !== 'active') {
        return { error: `Forbidden: Active admin or encoder role required.`, status: 403 }
    }

    return { user_id: payload.user_id, role: payload.role }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('X-Authorization') || req.headers.get('Authorization')
        const authResult = await authenticateUser(authHeader)

        if (authResult.error) {
            return new Response(JSON.stringify({ error: authResult.error }), {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        const { id }: RequestPayload = await req.json()

        if (!id) {
            return new Response(JSON.stringify({ error: 'Record ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // 1. Get record info to find storage path
        const { data: record, error: fetchError } = await supabaseAdmin
            .from('monthly_report_attachments')
            .select('file_path')
            .eq('id', id)
            .single()

        if (fetchError || !record) {
            return new Response(JSON.stringify({ error: 'Record not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        // 2. Delete from storage
        const { error: storageError } = await supabaseAdmin.storage
            .from('monthly-report-attachments')
            .remove([record.file_path])

        if (storageError) {
            console.error('Storage deletion error:', storageError)
            // Continue with record deletion even if storage fails? 
            // Better to keep it consistent but for now we proceed.
        }

        // 3. Delete record from database
        const { error: deleteError } = await supabaseAdmin
            .from('monthly_report_attachments')
            .delete()
            .eq('id', id)

        if (deleteError) {
            return new Response(JSON.stringify({ error: 'Failed to delete record: ' + deleteError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        return new Response(JSON.stringify({ success: true, message: 'Attachment purged successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })

    } catch (err) {
        console.error('Unexpected error:', err)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
    }
})
