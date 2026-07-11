'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'
import { useVesselItemAssignments, type ItemWithAssignment } from '@/features/vessels/hooks/useVesselItemAssignments'
import { Loader2 } from 'lucide-react'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface ManageEquipmentItemsProps {
    vesselId: string
    equipmentId: string
    equipmentName: string
    onBack: () => void
}

export function ManageEquipmentItems({ vesselId, equipmentId, equipmentName, onBack }: ManageEquipmentItemsProps) {
    const supabase = createClient()
    const { items, loading, error, refresh } = useVesselItemAssignments(vesselId, equipmentId)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [vesselBowNumber, setVesselBowNumber] = useState<string | null>(null)

    // Fetch vessel bow number for filtering
    useEffect(() => {
        const fetchVessel = async () => {
            if (!vesselId) return
            const { data } = await supabase
                .from('vessels')
                .select('bow_number')
                .eq('id', vesselId)
                .single()
            if (data) {
                setVesselBowNumber(data.bow_number)
            }
        }
        fetchVessel()
    }, [vesselId, supabase])

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    // Pre-select items that are already assigned to this vessel
    useEffect(() => {
        const assignedIds = new Set(
            items
                .filter(item => item.assignment_id !== null)
                .map(item => item.id)
        )
        setSelectedIds(assignedIds)
        setInitialAssignedIds(assignedIds)
    }, [items])

    // Separate items into two categories
    // Filter unassigned items to only show those with vessel-specific unique code pattern
    const unassignedItems = items.filter(item => {
        const isUnassigned = item.assignment_id === null && item.assigned_vessel_name === ''
        if (!isUnassigned || !vesselBowNumber) return false
        // Check if unique_code contains the vessel's bow number (e.g., CE01-PS177-XXXXX)
        return item.unique_code?.includes(vesselBowNumber) || false
    })
    const assignedToThisVessel = items.filter(item => item.assignment_id !== null)

    // Filter selectable items (only unassigned and assigned to this vessel can be toggled)
    const selectableItems = [...unassignedItems, ...assignedToThisVessel]

    // Check if there are any changes compared to initial state
    const hasChanges = () => {
        if (selectedIds.size !== initialAssignedIds.size) return true
        for (const id of selectedIds) {
            if (!initialAssignedIds.has(id)) return true
        }
        return false
    }

    // Check if items are being unassigned
    const hasUnassignments = () => {
        for (const id of initialAssignedIds) {
            if (!selectedIds.has(id)) return true
        }
        return false
    }

    const getUnassignedCount = () => {
        let count = 0
        for (const id of initialAssignedIds) {
            if (!selectedIds.has(id)) count++
        }
        return count
    }

    const handleSave = async () => {
        // Show confirmation modal if items are being unassigned
        if (hasUnassignments()) {
            setShowConfirmModal(true)
            return
        }

        await executeSave()
    }

    const executeSave = async () => {
        setSaving(true)
        setSaveError(null)
        try {
            const user = await getAuthUser()
            if (!user) throw new Error('Not authenticated')

            const token = await getValidAccessToken()
            if (!token) throw new Error('Not authenticated')

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-vessel-item-assignment`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'update',
                        vesselId,
                        equipmentId,
                        selectedIds: Array.from(selectedIds),
                    }),
                }
            )

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to save assignments')
            }

            await refresh()
            setSelectedIds(new Set())
            onBack()
        } catch (err: any) {
            setSaveError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-foreground-muted text-sm">{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
                <button
                    onClick={onBack}
                    className="text-sm text-foreground font-semibold pb-4 flex items-center gap-1 transition-colors border-b-2 border-foreground"
                >
                    ← Back to Equipments
                </button>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <span className="text-sm text-foreground-muted">
                            {selectedIds.size} selected
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges() || saving}
                        className="px-4 py-2 bg-accent text-white text-xs font-bold uppercase tracking-widest hover:bg-secondary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>

            <h3 className="text-md font-semibold text-foreground mb-4">
                {equipmentName} - Items
            </h3>

            {saveError && (
                <div className="mb-4 p-3 bg-error-bg border border-error/30 text-error text-sm">
                    {saveError}
                </div>
            )}

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-foreground-muted text-sm font-medium">No items</p>
                    <p className="text-foreground/40 text-xs mt-1">Items for this equipment will appear here</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto space-y-4 pr-2">
                    {/* Unassigned Items Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-foreground">
                                Unassigned Items ({unassignedItems.length})
                            </h4>
                            {unassignedItems.length > 0 && (
                                <button
                                    onClick={() => {
                                        const unassignedIds = new Set(unassignedItems.map(i => i.id))
                                        if (unassignedIds.size === selectedIds.size && [...unassignedIds].every(id => selectedIds.has(id))) {
                                            const newSelected = new Set(selectedIds)
                                            unassignedIds.forEach(id => newSelected.delete(id))
                                            setSelectedIds(newSelected)
                                        } else {
                                            setSelectedIds(new Set([...selectedIds, ...unassignedIds]))
                                        }
                                    }}
                                    className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    {unassignedItems.every(i => selectedIds.has(i.id)) ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>
                        {unassignedItems.length === 0 ? (
                            <div className="text-center py-4 text-foreground/40 text-sm">No unassigned items</div>
                        ) : (
                            <div className="border border-foreground/10 overflow-x-auto">
                                <table className="w-full relative">
                                    <thead className="sticky top-0 bg-surface z-10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                                        <tr className="border-b border-foreground/10 bg-foreground/5">
                                            <th className="text-left py-3 px-4 w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={unassignedItems.length > 0 && unassignedItems.every(i => selectedIds.has(i.id))}
                                                    onChange={() => {
                                                        const unassignedIds = new Set(unassignedItems.map(i => i.id))
                                                        if (unassignedIds.size === selectedIds.size && [...unassignedIds].every(id => selectedIds.has(id))) {
                                                            const newSelected = new Set(selectedIds)
                                                            unassignedIds.forEach(id => newSelected.delete(id))
                                                            setSelectedIds(newSelected)
                                                        } else {
                                                            setSelectedIds(new Set([...selectedIds, ...unassignedIds]))
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-foreground/20"
                                                />
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Unique Code</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Classification</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Nomenclature</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Brand</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Model</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Serial Number</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Part Number</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Date Manufactured</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Date Installed</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">ICS</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">PAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unassignedItems.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b border-foreground/5 hover:bg-foreground/3 transition-colors"
                                            >
                                                <td className="py-2 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(item.id)}
                                                        onChange={() => handleToggleSelect(item.id)}
                                                        className="w-4 h-4 rounded border-foreground/20"
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.unique_code || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_manufactured) || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Assigned to This Vessel Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-foreground">
                                Assigned to This Vessel ({assignedToThisVessel.length})
                            </h4>
                            {assignedToThisVessel.length > 0 && (
                                <button
                                    onClick={() => {
                                        const assignedIds = new Set(assignedToThisVessel.map(i => i.id))
                                        if (assignedIds.size === selectedIds.size && [...assignedIds].every(id => selectedIds.has(id))) {
                                            const newSelected = new Set(selectedIds)
                                            assignedIds.forEach(id => newSelected.delete(id))
                                            setSelectedIds(newSelected)
                                        } else {
                                            setSelectedIds(new Set([...selectedIds, ...assignedIds]))
                                        }
                                    }}
                                    className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    {assignedToThisVessel.every(i => selectedIds.has(i.id)) ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>
                        {assignedToThisVessel.length === 0 ? (
                            <div className="text-center py-4 text-foreground/40 text-sm">No items assigned to this vessel</div>
                        ) : (
                            <div className="border border-foreground/10 bg-secondary/5 overflow-x-auto">
                                <table className="w-full relative">
                                    <thead className="sticky top-0 bg-surface z-10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                                        <tr className="border-b border-foreground/10 bg-foreground/5">
                                            <th className="text-left py-3 px-4 w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={assignedToThisVessel.length > 0 && assignedToThisVessel.every(i => selectedIds.has(i.id))}
                                                    onChange={() => {
                                                        const assignedIds = new Set(assignedToThisVessel.map(i => i.id))
                                                        if (assignedIds.size === selectedIds.size && [...assignedIds].every(id => selectedIds.has(id))) {
                                                            const newSelected = new Set(selectedIds)
                                                            assignedIds.forEach(id => newSelected.delete(id))
                                                            setSelectedIds(newSelected)
                                                        } else {
                                                            setSelectedIds(new Set([...selectedIds, ...assignedIds]))
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-foreground/20"
                                                />
                                            </th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Unique Code</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Classification</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Nomenclature</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Brand</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Model</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Serial Number</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Part Number</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Date Manufactured</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Date Installed</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">ICS</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">PAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignedToThisVessel.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b border-foreground/5 hover:bg-foreground/3 transition-colors bg-secondary/10"
                                            >
                                                <td className="py-2 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(item.id)}
                                                        onChange={() => handleToggleSelect(item.id)}
                                                        className="w-4 h-4 rounded border-foreground/20"
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.unique_code || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_manufactured) || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={() => {
                    setShowConfirmModal(false)
                    executeSave()
                }}
                title="Unassign Items"
                message={`You are about to unassign ${getUnassignedCount()} item${getUnassignedCount() > 1 ? 's' : ''} from this vessel. These items will become available for assignment to other vessels. Do you want to continue?`}
                confirmText="Yes, Unassign"
                cancelText="Cancel"
                confirmButtonClassName="px-4 py-2.5 text-sm font-medium bg-error text-white hover:bg-error/90 transition-colors"
            />
        </div>
    )
}
