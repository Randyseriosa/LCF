/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface ImportItem {
  unique_code: string
  classification: string
  nomenclature: string
  brand: string
  model: string
  serial_number: string
  part_number: string
  date_manufactured: string
  date_installed_issued: string
  ics: string
  par: string
  quantity: number | null
  equipment_id?: string
}

/**
 * Parse date from various formats and return a Date object
 */
function parseDate(dateInput: string | number | null | undefined): Date | null {
  if (!dateInput) return null

  if (typeof dateInput === 'string' && dateInput.trim() === '') return null

  let date: Date

  if (typeof dateInput === 'number') {
    if (dateInput < 1 || dateInput > 100000) return null
    const excelEpoch = new Date(1900, 0, 1)
    const daysToAdd = dateInput - 2
    date = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
  } else if (typeof dateInput === 'string') {
    const trimmedInput = dateInput.trim()
    const ddmmyyyyMatch = trimmedInput.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (ddmmyyyyMatch) {
      const [, dayStr, monthStr, yearStr] = ddmmyyyyMatch
      const day = parseInt(dayStr, 10)
      const month = parseInt(monthStr, 10)
      const year = parseInt(yearStr, 10)
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
      date = new Date(year, month - 1, day)
    } else {
      date = new Date(trimmedInput)
    }
  } else {
    return null
  }

  if (isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null

  const checkDate = new Date(year, month - 1, day)
  if (checkDate.getFullYear() !== year || checkDate.getMonth() + 1 !== month || checkDate.getDate() !== day) {
    return null
  }

  return date
}

/**
 * Format date to ISO format YYYY-MM-DD (for database storage)
 */
function formatDateToISO(dateInput: string | number | null | undefined): string | null {
  const date = parseDate(dateInput)
  if (!date) return null

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

interface Payload {
  equipment_id?: string
  vessel_id?: string
  items: ImportItem[]
  overwrite?: boolean
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
    const { equipment_id, vessel_id, items, overwrite } = body

    // Safe logging without circular reference issues
    console.log('Received payload - equipment_id:', equipment_id, 'vessel_id:', vessel_id, 'items count:', items?.length, 'overwrite:', overwrite)

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('No new items to import. All items in the file may already exist in the system or no valid items were found.', 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch all equipments for prefix matching
    const { data: equipments, error: equipmentsError } = await supabaseAdmin
      .from('equipments')
      .select('id, unique_code')

    if (equipmentsError || !equipments) {
      return errorResponse('Failed to fetch equipments', 500)
    }

    // Fetch all vessels for bow matching
    const { data: vessels, error: vesselsError } = await supabaseAdmin
      .from('vessels')
      .select('id, bow_number, slug')

    if (vesselsError || !vessels) {
      return errorResponse('Failed to fetch vessels', 500)
    }

    const vesselMap: Record<string, string> = {}
    vessels.forEach((v: { id: string; bow_number: string | null }) => {
      if (v.bow_number && v.id) {
        vesselMap[v.bow_number] = v.id
      }
    })

    // Fetch all existing items with all specs for potential rollback/overwrite
    const uniqueCodes = items.map(item => item.unique_code)
    const { data: existingItems, error: existingItemsError } = await supabaseAdmin
      .from('items')
      .select('id, unique_code, classification, nomenclature, brand, model, serial_number, part_number, date_manufactured, date_installed_issued, ics, par, quantity, equipment_id')
      .in('unique_code', uniqueCodes)

    if (existingItemsError) {
      console.error('Error fetching existing items:', existingItemsError)
      return errorResponse(`Failed to check existing items: ${existingItemsError.message}`, 500)
    }

    // Build map of original specifications so we can roll back if needed
    const originalItemsMap = new Map<string, any>()
    if (existingItems) {
      for (const item of existingItems) {
        originalItemsMap.set(item.unique_code, {
          classification: item.classification,
          nomenclature: item.nomenclature,
          brand: item.brand,
          model: item.model,
          serial_number: item.serial_number,
          part_number: item.part_number,
          date_manufactured: item.date_manufactured,
          date_installed_issued: item.date_installed_issued,
          ics: item.ics,
          par: item.par,
          quantity: item.quantity,
          equipment_id: item.equipment_id
        })
      }
    }

    const existingUniqueCodes = new Set(existingItems?.map((item: { unique_code: string }) => item.unique_code) || [])
    console.log('[DEBUG] Existing unique codes:', Array.from(existingUniqueCodes))

    // Separate items to insert from items to update
    const itemsToInsertRaw = items.filter(item => !existingUniqueCodes.has(item.unique_code))
    const itemsToUpdateRaw = overwrite ? items.filter(item => existingUniqueCodes.has(item.unique_code)) : []

    console.log('[DEBUG] Items to insert:', itemsToInsertRaw.length, 'Items to update:', itemsToUpdateRaw.length)

    // Create a map of unique_code -> id for quick lookup
    const equipmentMap: Record<string, string> = {}
    equipments.forEach((equip: { id: string; unique_code: string | null }) => {
      if (equip.unique_code && equip.id) {
        equipmentMap[equip.unique_code] = equip.id
      }
    })

    const getCommonFields = (item: ImportItem) => {
      let itemEquipmentId = item.equipment_id || equipment_id

      if (!itemEquipmentId) {
        const uniqueCode = item.unique_code
        if (!uniqueCode) {
          throw new Error('unique_code is required in items when equipment_id is not provided')
        }

        const sortedEquipmentCodes = Object.keys(equipmentMap).sort((a, b) => b.length - a.length)
        let matchedEquipmentCode: string | null = null

        for (const equipCode of sortedEquipmentCodes) {
          if (uniqueCode.startsWith(equipCode)) {
            matchedEquipmentCode = equipCode
            break
          }
        }

        if (!matchedEquipmentCode) {
          throw new Error(`No matching equipment found for unique code: ${uniqueCode}`)
        }

        itemEquipmentId = equipmentMap[matchedEquipmentCode]
      }

      return {
        equipment_id: itemEquipmentId,
        unique_code: item.unique_code,
        classification: item.classification,
        nomenclature: item.nomenclature,
        brand: item.brand,
        model: item.model,
        serial_number: item.serial_number,
        part_number: item.part_number,
        date_manufactured: formatDateToISO(item.date_manufactured),
        date_installed_issued: formatDateToISO(item.date_installed_issued),
        ics: item.ics || null,
        par: item.par || null,
        quantity: item.quantity || null
      }
    }

    const mapInsertItemForDb = (item: ImportItem) => {
      let itemVesselId = vessel_id || null
      if (!itemVesselId && item.unique_code) {
        const sortedBows = Object.keys(vesselMap).sort((a, b) => b.length - a.length)
        for (const bow of sortedBows) {
          const escapedBow = bow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`(^|-)${escapedBow}(-|$)`)
          if (regex.test(item.unique_code)) {
            itemVesselId = vesselMap[bow]
            break
          }
        }

        if (!itemVesselId && item.unique_code.includes('OLCF6')) {
          const hqVessel = vessels.find((v: any) => v.bow_number === 'OLCF6' || v.slug === 'hq-inventory')
          if (hqVessel) {
            itemVesselId = hqVessel.id
          }
        }
      }

      return {
        ...getCommonFields(item),
        vessel_id: itemVesselId
      }
    }

    const mapUpdateItemForDb = (item: ImportItem) => {
      // vessel_id is strictly not included in the update mapping to prevent accidental vessel reassignments during overwrite
      return getCommonFields(item)
    }

    const itemsToInsert = itemsToInsertRaw.map(mapInsertItemForDb)
    const itemsToUpdate = itemsToUpdateRaw.map(mapUpdateItemForDb)

    let updatedCount = 0
    let insertedCount = 0
    const updatedItemsTracker: string[] = []
    const insertedIdsTracker: string[] = []

    try {
      // 1. Process updates first (if overwrite is true)
      if (itemsToUpdate.length > 0) {
        for (const item of itemsToUpdate) {
          const { data: updatedRows, error: updateError } = await supabaseAdmin
            .from('items')
            .update({
              classification: item.classification,
              nomenclature: item.nomenclature,
              brand: item.brand,
              model: item.model,
              serial_number: item.serial_number,
              part_number: item.part_number,
              date_manufactured: item.date_manufactured,
              date_installed_issued: item.date_installed_issued,
              ics: item.ics,
              par: item.par,
              quantity: item.quantity,
              equipment_id: item.equipment_id
            })
            .eq('unique_code', item.unique_code)
            .select('id')

          if (updateError) {
            console.error(`Error updating item ${item.unique_code}:`, updateError)
            throw new Error(`Failed to update item ${item.unique_code}: ${updateError.message}`)
          }

          if (!updatedRows || updatedRows.length !== 1) {
            throw new Error(`Failed to update item ${item.unique_code}: Expected exactly 1 row to be affected (found ${updatedRows?.length || 0}). The item might have been deleted between preview and confirm.`)
          }

          updatedItemsTracker.push(item.unique_code)
          updatedCount++
        }
      }

      // 2. Process insertions
      if (itemsToInsert.length > 0) {
        const { data: insertedItems, error: insertError } = await supabaseAdmin
          .from('items')
          .insert(itemsToInsert)
          .select()

        if (insertError) {
          console.error('Insert error:', insertError)
          throw new Error(`Failed to insert items: ${insertError.message}`)
        }

        if (insertedItems) {
          insertedCount = insertedItems.length
          for (const inserted of insertedItems) {
            insertedIdsTracker.push(inserted.id)
          }
        }

        // Create assignments for items that have a vessel_id
        const assignmentsToInsert = (insertedItems || [])
          .filter((item: any) => item.vessel_id)
          .map((item: any) => ({
            item_id: item.id,
            vessel_id: item.vessel_id,
            is_current: true
          }))

        if (assignmentsToInsert.length > 0) {
          const { data: insertedAssignments, error: assignError } = await supabaseAdmin
            .from('vessel_item_assignments')
            .insert(assignmentsToInsert)
            .select('id, item_id')

          if (assignError) {
            console.error('Assignment insert error:', assignError)
            throw new Error(`Failed to create vessel item assignments: ${assignError.message}`)
          }

          if (insertedAssignments) {
            // Update items to set current_assignment_id
            const updatePromises = insertedAssignments.map((assignment: any) =>
              supabaseAdmin
                .from('items')
                .update({ current_assignment_id: assignment.id })
                .eq('id', assignment.item_id)
                .select('id')
            )

            const chunkArray = (arr: any[], size: number) =>
              Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
              )

            for (const chunk of chunkArray(updatePromises, 50)) {
              const results = await Promise.all(chunk)
              for (const res of results) {
                if (res.error) {
                  throw new Error(`Failed to update item assignment link: ${res.error.message}`)
                }
                const updatedItemRows = res.data
                if (!updatedItemRows || updatedItemRows.length !== 1) {
                  throw new Error(`Failed to link item assignment: expected exactly 1 row to be affected.`)
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Operation failed, executing rollback...', err)

      // ROLLBACK UPDATES
      if (updatedItemsTracker.length > 0) {
        console.log(`Rolling back ${updatedItemsTracker.length} updated items...`)
        for (const uniqueCode of updatedItemsTracker) {
          const orig = originalItemsMap.get(uniqueCode)
          if (orig) {
            const { error: rollbackUpdateError } = await supabaseAdmin
              .from('items')
              .update(orig)
              .eq('unique_code', uniqueCode)
            if (rollbackUpdateError) {
              console.error(`CRITICAL: Rollback failed for update of item ${uniqueCode}:`, rollbackUpdateError)
            }
          }
        }
      }

      // ROLLBACK INSERTS
      if (insertedIdsTracker.length > 0) {
        console.log(`Rolling back ${insertedIdsTracker.length} inserted items...`)

        // Set current_assignment_id to null first to decouple foreign key loops
        const { error: disconnectError } = await supabaseAdmin
          .from('items')
          .update({ current_assignment_id: null })
          .in('id', insertedIdsTracker)

        if (disconnectError) {
          console.error(`Warning: Failed to disconnect assignment during rollback: ${disconnectError.message}`)
        }

        // Delete assignments explicitly
        const { error: deleteAssignmentsError } = await supabaseAdmin
          .from('vessel_item_assignments')
          .delete()
          .in('item_id', insertedIdsTracker)

        if (deleteAssignmentsError) {
          console.error(`Warning: Failed to delete assignments: ${deleteAssignmentsError.message}`)
        }

        // Finally delete items
        const { error: deleteItemsError } = await supabaseAdmin
          .from('items')
          .delete()
          .in('id', insertedIdsTracker)

        if (deleteItemsError) {
          console.error(`CRITICAL: Failed to delete items during rollback: ${deleteItemsError.message}`)
        }
      }

      return errorResponse(`Database import/update failed: ${(err as Error).message}`, 500)
    }

    if (insertedCount === 0 && updatedCount === 0) {
      return successResponse({
        message: 'No actions performed. All items in the file already exist and match their previous data, or were skipped.',
        insertedCount: 0,
        updatedCount: 0,
        skipped: items.length
      })
    }

    return successResponse({
      message: `Successfully processed items: ${insertedCount} inserted, ${updatedCount} updated.`,
      insertedCount,
      updatedCount,
      skipped: items.length - (insertedCount + updatedCount)
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse('Internal server error: ' + (err as Error).message, 500)
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
