/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface SyncItem {
    id?: string
    unique_code: string
    classification: string
    nomenclature: string
    brand: string
    model: string
    serial_number: string
    part_number: string
    date_manufactured: string | null
    date_installed_issued: string | null
    ics: string
    par: string
    quantity: number | null
    equipment_id?: string
    status?: string
    remarks?: string
}

interface Payload {
    month: number // 0-11
    year: number
    items: SyncItem[]
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
        const { month, year, items } = body

        if (month === undefined || year === undefined || !items || !Array.isArray(items)) {
            return errorResponse('month, year, and items are required', 400)
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // 1. Find the HQ Vessel
        const { data: hqVessel, error: hqVesselError } = await supabaseAdmin
            .from('vessels')
            .select('id')
            .eq('slug', 'hq-inventory')
            .single()

        if (hqVesselError || !hqVessel) {
            return errorResponse('HQ Inventory vessel record not found. Please run migrations.', 404)
        }

        // 2. Create or find the monthly report record
        const reportMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`

        // Check if report already exists
        const { data: existingReport } = await supabaseAdmin
            .from('monthly_reports')
            .select('id')
            .eq('vessel_id', hqVessel.id)
            .eq('report_month', reportMonth)
            .single()

        let reportId: string
        if (existingReport) {
            reportId = existingReport.id
            // Clear existing items for this report to overwrite
            await supabaseAdmin
                .from('monthly_report_items')
                .delete()
                .eq('report_id', reportId)
        } else {
            const { data: newReport, error: createError } = await supabaseAdmin
                .from('monthly_reports')
                .insert({
                    vessel_id: hqVessel.id,
                    report_month: reportMonth,
                    imported_by: jwtPayload.user_id
                })
                .select('id')
                .single()

            if (createError || !newReport) {
                return errorResponse('Failed to create monthly report record', 500)
            }
            reportId = newReport.id
        }

        // 3. Process items - Ensure all items exist in the masterlist first
        const uniqueCodes = items.map((i: SyncItem) => i.unique_code)
        const { data: existingItemsInMaster } = await supabaseAdmin
            .from('items')
            .select('id, unique_code')
            .in('unique_code', uniqueCodes)

        const masterItemMap = new Map(existingItemsInMaster?.map((i: { id: string; unique_code: string }) => [i.unique_code, i.id]) || [])

        // Identify new items to insert into masterlist
        const newItemsToInsert = items
            .filter((i: SyncItem) => !masterItemMap.has(i.unique_code))
            .map((i: SyncItem) => ({
                unique_code: i.unique_code,
                equipment_id: i.equipment_id,
                classification: i.classification,
                nomenclature: i.nomenclature,
                brand: i.brand,
                model: i.model,
                serial_number: i.serial_number,
                part_number: i.part_number,
                date_manufactured: i.date_manufactured,
                date_installed_issued: i.date_installed_issued,
                quantity: i.quantity,
                ics: i.ics,
                par: i.par
            }))

        if (newItemsToInsert.length > 0) {
            const { data: insertedItems, error: insertError } = await supabaseAdmin
                .from('items')
                .insert(newItemsToInsert)
                .select('id, unique_code')

            if (insertError) {
                console.error('Error inserting new items to masterlist:', insertError)
                // Continue anyway? Or fail? Let's fail for safety.
                return errorResponse(`Failed to update masterlist with new items: ${insertError.message}`, 500)
            }

            insertedItems?.forEach((i: { id: string; unique_code: string }) => {
                masterItemMap.set(i.unique_code, i.id)
            })
        }

        // 4. Insert into monthly_report_items
        const reportItemsToInsert = items.map((i: SyncItem) => ({
            report_id: reportId,
            item_id: masterItemMap.get(i.unique_code),
            unique_code: i.unique_code,
            classification: i.classification,
            nomenclature: i.nomenclature,
            brand: i.brand,
            model: i.model,
            serial_number: i.serial_number,
            part_number: i.part_number,
            date_manufactured: i.date_manufactured,
            date_installed_issued: i.date_installed_issued,
            quantity: i.quantity,
            ics: i.ics,
            par: i.par,
            status: i.status || 'Active', // Default status
            remarks: i.remarks || ''
        }))

        // Use batches for large imports
        const batchSize = 100
        for (let i = 0; i < reportItemsToInsert.length; i += batchSize) {
            const batch = reportItemsToInsert.slice(i, i + batchSize)
            const { error: batchError } = await supabaseAdmin
                .from('monthly_report_items')
                .insert(batch)

            if (batchError) {
                return errorResponse(`Failed to insert report items batch: ${batchError.message}`, 500)
            }
        }

        return successResponse({
            message: `Successfully synchronized ${items.length} items for HQ Inventory`,
            report_id: reportId
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
