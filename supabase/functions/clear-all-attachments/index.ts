/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-authorization, x-client-info, apikey, content-type',
}

interface RequestPayload {
    report_month: string
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

        const { report_month }: RequestPayload = await req.json()

        if (!report_month) {
            return new Response(JSON.stringify({ error: 'report_month is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        console.log(`[clear-all-attachments] Target month: ${report_month}`)

        // 1. Get all records for this month to find storage paths
        const { data: records, error: fetchError } = await supabaseAdmin
            .from('monthly_report_attachments')
            .select('file_path')
            .eq('report_month', report_month)

        if (fetchError) {
            console.error('[clear-all-attachments] Fetch error:', fetchError)
            return new Response(JSON.stringify({ error: 'Failed to fetch records: ' + fetchError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
        }

        console.log(`[clear-all-attachments] Found ${records?.length || 0} records to purge`)

        if (records && records.length > 0) {
            // 2. Delete all from storage
            const filePaths = records.map((r: { file_path: string }) => r.file_path)
            console.log('[clear-all-attachments] Deleting files from storage:', filePaths)

            const { error: storageError } = await supabaseAdmin.storage
                .from('monthly-report-attachments')
                .remove(filePaths)

            if (storageError) {
                console.error('[clear-all-attachments] Storage deletion error:', storageError)
            }

            // 3. Delete all records from database for this month
            console.log('[clear-all-attachments] Deleting records from database...')
            const { error: deleteError } = await supabaseAdmin
                .from('monthly_report_attachments')
                .delete()
                .eq('report_month', report_month)

            if (deleteError) {
                console.error('[clear-all-attachments] DB deletion error:', deleteError)
                return new Response(JSON.stringify({ error: 'Failed to delete records: ' + deleteError.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                })
            }
        }

        console.log('[clear-all-attachments] Purge operation complete')
        return new Response(JSON.stringify({ success: true, message: `Successfully cleared ${records?.length || 0} attachments` }), {
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
