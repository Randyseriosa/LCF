/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

interface Payload {
  action: 'create' | 'update' | 'delete' | 'transfer' | 'preview'
  item_id?: string
  vessel_id?: string
  assignment_id?: string
  vesselId?: string
  equipmentId?: string
  selectedIds?: string[]
  customCodes?: Record<string, string>
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
    const { action, item_id, vessel_id, assignment_id, vesselId, equipmentId, selectedIds, customCodes } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'create') {
      if (!item_id || !vessel_id) {
        return errorResponse('item_id and vessel_id are required for create', 400)
      }

      // Deactivate any existing active assignment for this item to enforce uniqueness
      await supabaseAdmin
        .from('vessel_item_assignments')
        .update({ is_current: false })
        .eq('item_id', item_id)
        .eq('is_current', true)

      // Create new assignment
      const { error: insertError, data: assignment } = await supabaseAdmin
        .from('vessel_item_assignments')
        .insert({ item_id, vessel_id, is_current: true })
        .select()
        .single()

      if (insertError) return errorResponse(insertError.message, 500)

      // Update item's current_assignment_id and vessel_id
      const { error: updateError } = await supabaseAdmin
        .from('items')
        .update({ current_assignment_id: assignment.id, vessel_id: vessel_id })
        .eq('id', item_id)

      if (updateError) return errorResponse(updateError.message, 500)

      return successResponse(assignment)

    } else if (action === 'update') {
      // Handle bulk assignment for selected items
      if (vesselId && equipmentId && selectedIds) {
        // Get all items for this equipment
        const { data: equipmentItems } = await supabaseAdmin
          .from('items')
          .select('id')
          .eq('equipment_id', equipmentId)

        const equipmentItemIds = new Set((equipmentItems || []).map((i: { id: string }) => i.id))

        // Get all items currently assigned to this vessel
        const { data: currentAssignments } = await supabaseAdmin
          .from('vessel_item_assignments')
          .select('id, item_id')
          .eq('vessel_id', vesselId)
          .eq('is_current', true)
          .in('item_id', Array.from(equipmentItemIds))

        const currentlyAssignedItemIds = new Set(
          (currentAssignments || []).map((a: { id: string; item_id: string }) => a.item_id)
        )
        const selectedIdsSet = new Set(selectedIds)

        // Unassign items that were previously assigned but are now deselected
        for (const assignment of currentAssignments || []) {
          if (!selectedIdsSet.has(assignment.item_id)) {
            // Mark assignment as not current
            await supabaseAdmin
              .from('vessel_item_assignments')
              .update({ is_current: false })
              .eq('id', assignment.id)

            // Clear item's current_assignment_id and vessel_id
            await supabaseAdmin
              .from('items')
              .update({ current_assignment_id: null, vessel_id: null })
              .eq('id', assignment.item_id)
          }
        }

        // Assign newly selected items
        const assignments = []

        for (const itemId of selectedIds) {
          // Skip if already assigned to this vessel
          if (currentlyAssignedItemIds.has(itemId)) {
            continue
          }

          // Mark any existing assignments for this item as not current
          await supabaseAdmin
            .from('vessel_item_assignments')
            .update({ is_current: false })
            .eq('item_id', itemId)
            .eq('is_current', true)

          // Create new assignment
          const { data: newAssignment, error: insertError } = await supabaseAdmin
            .from('vessel_item_assignments')
            .insert({ item_id: itemId, vessel_id: vesselId, is_current: true })
            .select()
            .single()

          if (insertError) {
            console.error(`Failed to assign item ${itemId}:`, insertError)
            continue
          }

          // Update item's current_assignment_id and vessel_id
          await supabaseAdmin
            .from('items')
            .update({ current_assignment_id: newAssignment.id, vessel_id: vesselId })
            .eq('id', itemId)

          assignments.push(newAssignment)
        }

        return successResponse({ success: true, assigned: assignments.length })
      }

      // Original single assignment update
      if (!assignment_id) return errorResponse('assignment_id is required for update', 400)

      // For future transfer functionality - mark old assignment as non-current
      // and create new one. For now, simple update of vessel_id
      const updates: any = {}
      if (vessel_id !== undefined) updates.vessel_id = vessel_id

      if (Object.keys(updates).length === 0) {
        return errorResponse('No fields to update', 400)
      }

      const { error, data } = await supabaseAdmin
        .from('vessel_item_assignments')
        .update(updates)
        .eq('id', assignment_id)
        .select()
        .single()

      if (error) return errorResponse(error.message, 500)
      return successResponse(data)

    } else if (action === 'transfer' && vesselId && selectedIds) {
      const assignments = []

      // Fetch target vessel
      const { data: targetVessel } = await supabaseAdmin
        .from('vessels')
        .select('bow_number')
        .eq('id', vesselId)
        .single()

      if (!targetVessel) {
        return errorResponse('Target vessel not found', 404)
      }

      const bowNumber = targetVessel.bow_number
      // Counter keyed by the classification prefix (e.g. 'WE01') so each classification
      // gets its own sequence scoped to the recipient vessel.
      const prefixCounters = new Map<string, number>()

      // Derive the next unique code for an item being transferred.
      // Uses the source item's own unique_code prefix (e.g. 'WE01' from 'WE01-OLCF6-006')
      // so the sequence is scoped by classification, not just by equipment.
      const getNextUniqueCode = async (equipmentId: string, sourceUniqueCode: string): Promise<string> => {
        // Extract the type prefix from the source code (first segment before '-')
        let eqTypeCode = sourceUniqueCode ? sourceUniqueCode.split('-')[0] : ''

        // Fallback: derive from equipment base code
        if (!eqTypeCode) {
          const { data: eq } = await supabaseAdmin
            .from('equipments')
            .select('unique_code')
            .eq('id', equipmentId)
            .single()
          eqTypeCode = eq?.unique_code || 'XX'
          if (eqTypeCode.length === 2) eqTypeCode += '01'
        }

        const counterKey = eqTypeCode
        if (!prefixCounters.has(counterKey)) {
          // Find max sequence among recipient items with the same classification prefix
          const { data: items } = await supabaseAdmin
            .from('items')
            .select('unique_code')
            .eq('vessel_id', vesselId)
            .like('unique_code', `${eqTypeCode}-${bowNumber}-%`)
            .order('unique_code', { ascending: false })
            .limit(1)

          let nextNumber = 1
          if (items && items.length > 0 && items[0].unique_code) {
            const parts = items[0].unique_code.split('-')
            const lastNumber = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(lastNumber)) {
              nextNumber = lastNumber + 1
            }
          }
          prefixCounters.set(counterKey, nextNumber)
        }

        const currentNum = prefixCounters.get(counterKey)!
        prefixCounters.set(counterKey, currentNum + 1)
        const sequentialNumber = currentNum.toString().padStart(3, '0')

        return `${eqTypeCode}-${bowNumber}-${sequentialNumber}`
      }

      // PHASE 1: Resolve all proposed unique codes and check basic details
      const resolvedItems = []
      for (const itemId of selectedIds) {
        // Find current assignment & item details
        const { data: existingAssignment } = await supabaseAdmin
          .from('vessel_item_assignments')
          .select('id, item_id, vessel_id')
          .eq('item_id', itemId)
          .eq('is_current', true)
          .maybeSingle()

        // Get item info
        const { data: itemInfo } = await supabaseAdmin
          .from('items')
          .select('id, equipment_id, unique_code, vessel_id, nomenclature')
          .eq('id', itemId)
          .single()

        if (!itemInfo) {
          return errorResponse(`Item with ID ${itemId} not found`, 404)
        }

        // Skip if it's already assigned to target vessel
        if (existingAssignment && existingAssignment.vessel_id === vesselId) {
          continue
        }

        let newUniqueCode = customCodes?.[itemId]
        if (!newUniqueCode) {
          newUniqueCode = await getNextUniqueCode(itemInfo.equipment_id, itemInfo.unique_code)
        }

        newUniqueCode = newUniqueCode.trim()
        if (!newUniqueCode) {
          return errorResponse(`Unique code for item '${itemInfo.nomenclature}' cannot be empty`, 400)
        }

        resolvedItems.push({
          itemId,
          itemInfo,
          existingAssignment,
          newUniqueCode,
          oldVesselId: existingAssignment ? existingAssignment.vessel_id : itemInfo.vessel_id,
          oldUniqueCode: itemInfo.unique_code
        })
      }

      // PHASE 2: Validation Check against Duplicate Unique Codes
      // a) check batch internal duplicates
      const batchCodes = new Set<string>()
      for (const item of resolvedItems) {
        if (batchCodes.has(item.newUniqueCode)) {
          return errorResponse(`Duplicate unique code collision: '${item.newUniqueCode}' is assigned to multiple items in this transfer batch.`, 400)
        }
        batchCodes.add(item.newUniqueCode)
      }

      // b) check database collisions
      if (resolvedItems.length > 0) {
        const uniqueCodesToCheck = resolvedItems.map(item => item.newUniqueCode)
        const { data: existingItems, error: checkError } = await supabaseAdmin
          .from('items')
          .select('id, unique_code, nomenclature')
          .in('unique_code', uniqueCodesToCheck)

        if (checkError) {
          return errorResponse(`Error checking code uniqueness: ${checkError.message}`, 500)
        }

        if (existingItems && existingItems.length > 0) {
          // If any code belongs to a DIFFERENT item, fail.
          for (const ext of existingItems) {
            const match = resolvedItems.find(item => item.newUniqueCode === ext.unique_code)
            if (match && match.itemId !== ext.id) {
              return errorResponse(`Unique code collision: Code '${ext.unique_code}' is already assigned to item '${ext.nomenclature}' in the database.`, 400)
            }
          }
        }
      }

      // PHASE 3: Perform mutations (now guaranteed to not violate unique code constraints)
      for (const item of resolvedItems) {
        const { itemId, itemInfo, existingAssignment, newUniqueCode, oldVesselId, oldUniqueCode } = item

        if (existingAssignment) {
          // Mark existing assignment as not current
          const { error: updateOldErr } = await supabaseAdmin
            .from('vessel_item_assignments')
            .update({ is_current: false })
            .eq('id', existingAssignment.id)

          if (updateOldErr) {
            return errorResponse(`Failed to update old assignment: ${updateOldErr.message}`, 500)
          }
        }

        // Create new assignment
        const { data: newAssignment, error: insertError } = await supabaseAdmin
          .from('vessel_item_assignments')
          .insert({ item_id: itemId, vessel_id: vesselId, is_current: true })
          .select()
          .single()

        if (insertError) {
          return errorResponse(`Failed to assign item ${itemInfo.nomenclature}: ${insertError.message}`, 500)
        }

        // Update item's current_assignment_id, vessel_id, unique_code
        const { error: updateItemErr } = await supabaseAdmin
          .from('items')
          .update({
            current_assignment_id: newAssignment.id,
            vessel_id: vesselId,
            unique_code: newUniqueCode
          })
          .eq('id', itemId)

        if (updateItemErr) {
          return errorResponse(`Failed to update item unique code for ${itemInfo.nomenclature}: ${updateItemErr.message}`, 500)
        }

        // Insert into item_transfer_logs
        const { error: logErr } = await supabaseAdmin
          .from('item_transfer_logs')
          .insert({
            item_id: itemId,
            old_vessel_id: oldVesselId,
            new_vessel_id: vesselId,
            old_unique_code: oldUniqueCode,
            new_unique_code: newUniqueCode,
            performed_by: jwtPayload.user_id,
            action: 'Transferred'
          })

        if (logErr) {
          return errorResponse(`Failed to create transfer log: ${logErr.message}`, 500)
        }

        assignments.push({
          item_id: itemId,
          nomenclature: itemInfo.nomenclature,
          old_unique_code: oldUniqueCode,
          new_unique_code: newUniqueCode
        })
      }

      return successResponse({ success: true, transferred: assignments.length, items: assignments })

    } else if (action === 'preview' && vesselId && selectedIds) {
      const assignments = []

      // Fetch target vessel
      const { data: targetVessel } = await supabaseAdmin
        .from('vessels')
        .select('bow_number')
        .eq('id', vesselId)
        .single()

      if (!targetVessel) {
        return errorResponse('Target vessel not found', 404)
      }

      const bowNumber = targetVessel.bow_number
      // Counter keyed by the classification prefix (e.g. 'WE01') so each classification
      // gets its own sequence scoped to the recipient vessel.
      const prefixCountersPreview = new Map<string, number>()

      const getNextUniqueCodePreview = async (equipmentId: string, sourceUniqueCode: string): Promise<string> => {
        // Extract the type prefix from the source code (first segment before '-')
        let eqTypeCode = sourceUniqueCode ? sourceUniqueCode.split('-')[0] : ''

        // Fallback: derive from equipment base code
        if (!eqTypeCode) {
          const { data: eq } = await supabaseAdmin
            .from('equipments')
            .select('unique_code')
            .eq('id', equipmentId)
            .single()
          eqTypeCode = eq?.unique_code || 'XX'
          if (eqTypeCode.length === 2) eqTypeCode += '01'
        }

        const counterKey = eqTypeCode
        if (!prefixCountersPreview.has(counterKey)) {
          // Find max sequence among recipient items with the same classification prefix
          const { data: items } = await supabaseAdmin
            .from('items')
            .select('unique_code')
            .eq('vessel_id', vesselId)
            .like('unique_code', `${eqTypeCode}-${bowNumber}-%`)
            .order('unique_code', { ascending: false })
            .limit(1)

          let nextNumber = 1
          if (items && items.length > 0 && items[0].unique_code) {
            const parts = items[0].unique_code.split('-')
            const lastNumber = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(lastNumber)) {
              nextNumber = lastNumber + 1
            }
          }
          prefixCountersPreview.set(counterKey, nextNumber)
        }

        const currentNum = prefixCountersPreview.get(counterKey)!
        prefixCountersPreview.set(counterKey, currentNum + 1)
        const sequentialNumber = currentNum.toString().padStart(3, '0')

        return `${eqTypeCode}-${bowNumber}-${sequentialNumber}`
      }

      for (const itemId of selectedIds) {
        const { data: existingAssignment } = await supabaseAdmin
          .from('vessel_item_assignments')
          .select('id, vessel_id')
          .eq('item_id', itemId)
          .eq('is_current', true)
          .maybeSingle()

        const { data: itemInfo } = await supabaseAdmin
          .from('items')
          .select('equipment_id, unique_code, nomenclature')
          .eq('id', itemId)
          .single()

        if (!itemInfo) continue
        if (existingAssignment && existingAssignment.vessel_id === vesselId) continue

        const newUniqueCode = await getNextUniqueCodePreview(itemInfo.equipment_id, itemInfo.unique_code)

        assignments.push({
          item_id: itemId,
          nomenclature: itemInfo.nomenclature,
          old_unique_code: itemInfo.unique_code,
          new_unique_code: newUniqueCode
        })
      }

      return successResponse({ success: true, items: assignments })

    } else if (action === 'delete') {
      if (!assignment_id) return errorResponse('assignment_id is required for delete', 400)

      // Get the assignment to find the item_id
      const { data: assignment } = await supabaseAdmin
        .from('vessel_item_assignments')
        .select('item_id')
        .eq('id', assignment_id)
        .single()

      if (!assignment) return errorResponse('Assignment not found', 404)

      // Delete the assignment
      const { error } = await supabaseAdmin
        .from('vessel_item_assignments')
        .delete()
        .eq('id', assignment_id)

      if (error) return errorResponse(error.message, 500)

      // Clear the item's current_assignment_id and vessel_id
      await supabaseAdmin
        .from('items')
        .update({ current_assignment_id: null, vessel_id: null })
        .eq('id', assignment.item_id)

      return successResponse({ success: true })
    }

    return errorResponse('Invalid action', 400)
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
