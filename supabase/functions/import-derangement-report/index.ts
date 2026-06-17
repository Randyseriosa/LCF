/// <reference path="../deno.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
    file_data: string
    filename: string
    vessel_id?: string
    item_id?: string
    remarks?: string
    report_month?: string
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

    if (!['admin', 'encoder'].includes(payload.role) || payload.is_active !== 'active') {
        return { error: `Forbidden: Active admin or encoder role required. Current role: ${payload.role}, Status: ${payload.is_active}`, status: 403 }
    }

    return { user_id: payload.user_id, role: payload.role }
}

function decodeBase64File(fileData: string): Uint8Array {
    const base64Data = fileData.split(',')[1]
    if (!base64Data) {
        throw new Error('Invalid base64 data format')
    }
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
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
        const authResult = await authenticateUser(authHeader)

        if (authResult.error) {
            console.error('[import-derangement-report] Auth error:', authResult.error)
            return errorResponse(authResult.error, authResult.status)
        }

        const body: Payload = await req.json()
        const { file_data, filename, vessel_id, item_id, remarks, report_month } = body

        if (!file_data || !filename) {
            return errorResponse('file_data and filename are required', 400)
        }

        if (!vessel_id) {
            return errorResponse('vessel_id is required', 400)
        }

        if (!item_id) {
            return errorResponse('item_id is required', 400)
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Resolve profile ID
        let profileId: string | null = null
        const { data: profByAuth } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('auth_user_id', authResult.user_id)
            .single()

        if (profByAuth) {
            profileId = profByAuth.id
        } else {
            // Fallback: try matching by id directly
            const { data: profDirect } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', authResult.user_id)
                .single()
            if (profDirect) {
                profileId = profDirect.id
            }
        }

        if (!profileId) {
            return errorResponse('Importer profile not found for user ID: ' + authResult.user_id, 404)
        }

        // Verify vessel exists
        const { data: vessel, error: vesselError } = await supabaseAdmin
            .from('vessels')
            .select('id, bow_number')
            .eq('id', vessel_id)
            .single()

        if (vesselError || !vessel) {
            return errorResponse('Vessel not found: ' + (vesselError?.message || ''), 404)
        }

        // Verify item exists
        const { data: item, error: itemError } = await supabaseAdmin
            .from('items')
            .select('id, unique_code')
            .eq('id', item_id)
            .single()

        if (itemError || !item) {
            return errorResponse('Item not found: ' + (itemError?.message || ''), 404)
        }

        const bytes = decodeBase64File(file_data)

        // Use provided report_month or default to current month
        let finalReportMonth = report_month
        if (!finalReportMonth) {
            const now = new Date()
            finalReportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        }

        const timestamp = Date.now()
        const storagePath = `${vessel.bow_number}/${item.unique_code}/${timestamp}_${filename}`

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('derangement-reports')
            .upload(storagePath, bytes, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (uploadError) {
            return errorResponse('Failed to upload PDF to storage: ' + uploadError.message, 500)
        }

        // Insert into derangement_reports table
        const { data: newReport, error: insertError } = await supabaseAdmin
            .from('derangement_reports')
            .insert({
                vessel_id: vessel_id,
                item_id: item_id,
                report_month: finalReportMonth,
                file_path: storagePath,
                filename: filename,
                imported_by: profileId,
                remarks: remarks || null
            })
            .select()
            .single()

        if (insertError) {
            return errorResponse('Failed to record derangement report: ' + insertError.message, 500)
        }

        return successResponse({
            message: `Successfully uploaded ${filename} for item ${item.unique_code}`,
            report: newReport
        })

    } catch (err) {
        console.error('[import-derangement-report] Internal error:', err)
        return errorResponse('Internal server error: ' + (err as Error).message, 500)
    }
})

function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        },
    })
}

function successResponse(data: any) {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        },
    })
}
