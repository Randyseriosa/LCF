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
    quantity: number | null // Used as input for balance_on_hand
    date_last_pms?: string | null
    date_last_repair?: string | null
    running_hours?: number | null
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

        // 2. Validate all items exist in the masterlist and fetch their equipment type.
        //    Monthly report imports must NOT modify the masterlist (items table).
        const uniqueCodes = items.map((i: SyncItem) => i.unique_code)
        const { data: existingItemsInMaster } = await supabaseAdmin
            .from('items')
            .select(`
                id, 
                unique_code,
                equipments!inner (
                    equipment_type
                )
            `)
            .in('unique_code', uniqueCodes)

        const masterItemMap = new Map()
        existingItemsInMaster?.forEach((item: any) => {
            masterItemMap.set(item.unique_code, {
                id: item.id,
                equipment_type: item.equipments.equipment_type
            })
        })

        // Block the import if any item in the monthly report file is not in the masterlist
        const missingFromMasterlist = items.filter((i: SyncItem) => !masterItemMap.has(i.unique_code))
        if (missingFromMasterlist.length > 0) {
            const missingCodes = missingFromMasterlist.slice(0, 10).map((i: SyncItem) => i.unique_code).join(', ')
            return errorResponse(
                `Import blocked. The following items are not in the HQ Inventory masterlist: ${missingCodes}${missingFromMasterlist.length > 10 ? '...' : ''}. Please upload the masterlist first via the Masterlist tab.`,
                400
            )
        }

        // 3. Resolve profiles.id from auth_users.id stored in JWT.
        //    monthly_reports.imported_by references profiles.id, not auth_users.id.
        const { data: importerProfile, error: importerError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('auth_user_id', jwtPayload.user_id)
            .single()

        if (importerError || !importerProfile) {
            console.error('[sync-hq-inventory] Profile lookup failed:', importerError)
            return errorResponse('Importer profile not found', 404)
        }

        const importerId = importerProfile.id

        // 4. Create or find the monthly report record (only after validation passes)
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
                    imported_by: importerId
                })
                .select('id')
                .single()

            if (createError || !newReport) {
                return errorResponse('Failed to create monthly report record', 500)
            }
            reportId = newReport.id
        }

        // 5. Insert into monthly_report_items
        const reportItemsToInsert = items.map((i: SyncItem) => {
            const masterInfo = masterItemMap.get(i.unique_code)
            const isAmmunition = masterInfo?.equipment_type === 'ammunitions'

            return {
                report_id: reportId,
                item_id: masterInfo.id,
                unique_code: i.unique_code,
                classification: i.classification,
                nomenclature: i.nomenclature,
                brand: i.brand,
                model: i.model,
                serial_number: i.serial_number,
                part_number: i.part_number,
                date_manufactured: i.date_manufactured || null,
                date_installed_issued: i.date_installed_issued || null,
                ics: i.ics,
                par: i.par,
                balance_on_hand: isAmmunition ? i.quantity : null,
                date_last_pms: i.date_last_pms || null,
                date_last_repair: i.date_last_repair || null,
                running_hours: i.running_hours || null,
                status: i.status || 'Active',
                remarks: i.remarks || ''
            }
        })

        // Use batches for large imports
        try {
            const batchSize = 100
            for (let i = 0; i < reportItemsToInsert.length; i += batchSize) {
                const batch = reportItemsToInsert.slice(i, i + batchSize)
                const { error: batchError } = await supabaseAdmin
                    .from('monthly_report_items')
                    .insert(batch)

                if (batchError) {
                    throw new Error(`Batch insert failed: ${batchError.message}`)
                }
            }
        } catch (batchError: any) {
            console.error('[sync-hq-inventory] Batch insert error:', batchError)

            // ROLLBACK: If it was a newly created report, delete it.
            // If it was an existing report, it's now empty (we deleted items at line 133). 
            // In either case, deleting it ensures the status shows "Not Submitted" instead of a broken report.
            await supabaseAdmin.from('monthly_reports').delete().eq('id', reportId)

            return errorResponse(`Failed to insert report items: ${batchError.message}`, 500)
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
