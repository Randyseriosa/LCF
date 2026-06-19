/// <reference path="../deno.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
    file_data: string
    filename: string
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
        return { error: `Forbidden: Active admin or encoder role required.`, status: 403 }
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
                'Access-Control-Allow-Headers': 'authorization, x-authorization, x-client-info, apikey, content-type',
            },
        })
    }

    try {
        const authHeader = req.headers.get('X-Authorization') || req.headers.get('Authorization')
        const authResult = await authenticateUser(authHeader)

        if (authResult.error) {
            console.error('[import-monthly-report-attachment] Auth error:', authResult.error)
            return errorResponse(authResult.error, authResult.status)
        }

        const body: Payload = await req.json()
        const { file_data, filename } = body

        if (!file_data || !filename) {
            return errorResponse('file_data and filename are required', 400)
        }

        // Parse filename: PS100-062026-attachment.pdf
        const regex = /^([^-]+)-(\d{6})-attachment\.pdf$/i
        const match = filename.match(regex)

        if (!match) {
            return errorResponse('Invalid filename format. Expected "Bow-MMYYYY-attachment.pdf"', 400)
        }

        const bowNumber = match[1]
        const rawDate = match[2] // MMYYYY
        const month = rawDate.substring(0, 2)
        const year = rawDate.substring(2)
        const reportMonth = `${year}-${month}-01`

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Resolve profile ID (matching pattern from derangement report import)
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
            console.error('[import-monthly-report-attachment] Profile not found for user ID:', authResult.user_id)
            return errorResponse('Importer profile not found', 404)
        }

        // Find Vessel
        const { data: vessel, error: vesselError } = await supabaseAdmin
            .from('vessels')
            .select('id, bow_number')
            .eq('bow_number', bowNumber.toUpperCase())
            .single()

        if (vesselError || !vessel) {
            // Try fallback case-insensitive or exact bow number match if the user typed it differently
            const { data: vesselFallback } = await supabaseAdmin
                .from('vessels')
                .select('id, bow_number')
                .ilike('bow_number', bowNumber)
                .single()

            if (!vesselFallback) {
                return errorResponse(`Vessel with Bow Number "${bowNumber}" not found`, 404)
            }
            vessel.id = vesselFallback.id
            vessel.bow_number = vesselFallback.bow_number
        }

        const bytes = decodeBase64File(file_data)
        const timestamp = Date.now()
        const storagePath = `${vessel.bow_number}/${year}/${month}/${timestamp}_${filename}`

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('monthly-report-attachments')
            .upload(storagePath, bytes, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (uploadError) {
            return errorResponse('Failed to upload PDF: ' + uploadError.message, 500)
        }

        // Insert Record
        const { data: newRecord, error: insertError } = await supabaseAdmin
            .from('monthly_report_attachments')
            .insert({
                vessel_id: vessel.id,
                report_month: reportMonth,
                file_path: storagePath,
                filename: filename,
                imported_by: profileId
            })
            .select()
            .single()

        if (insertError) {
            return errorResponse('Failed to record attachment info: ' + insertError.message, 500)
        }

        return successResponse({
            message: `Successfully imported attachment for ${vessel.bow_number}`,
            record: newRecord
        })

    } catch (err) {
        console.error('[import-monthly-report-attachment] error:', err)
        return errorResponse('Internal error: ' + (err as Error).message, 500)
    }
})

function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-authorization, x-client-info, apikey, content-type'
        },
    })
}

function successResponse(data: any) {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-authorization, x-client-info, apikey, content-type'
        },
    })
}
