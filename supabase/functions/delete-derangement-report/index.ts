/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

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

        // Only admin and encoder can delete reports
        if (!['admin', 'encoder'].includes(jwtPayload.role) || jwtPayload.is_active !== 'active') {
            return errorResponse('Forbidden: Active admin or encoder role required', 403)
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { id } = await req.json()
        if (!id) return errorResponse('Report ID is required', 400)

        // 1. Get the report to find file_path
        const { data: report, error: fetchError } = await supabaseAdmin
            .from('derangement_reports')
            .select('file_path')
            .eq('id', id)
            .single()

        if (fetchError || !report) {
            return errorResponse('Report not found', 404)
        }

        // 2. Delete from storage if file_path exists
        if (report.file_path) {
            const { error: storageError } = await supabaseAdmin.storage
                .from('derangement-reports')
                .remove([report.file_path])

            if (storageError) {
                console.error('Failed to delete from storage:', storageError)
                // We continue to delete the DB record even if storage fails 
                // to avoid orphaned DB records that can't be deleted.
            }
        }

        // 3. Delete from database
        const { error: deleteError } = await supabaseAdmin
            .from('derangement_reports')
            .delete()
            .eq('id', id)

        if (deleteError) {
            return errorResponse(deleteError.message, 500)
        }

        return successResponse({ message: 'Derangement report and file deleted successfully' })

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
