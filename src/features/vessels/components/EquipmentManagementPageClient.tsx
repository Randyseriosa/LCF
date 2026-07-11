'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Role } from '@/lib/types/roles'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useEquipmentWithItems } from '@/features/equipment/hooks/useEquipmentWithItems'
import { useChanges } from '@/hooks/useChanges'

interface VesselData {
    id: string
    bow_number: string
    class_of_vessel: string
}

interface ClassOfVesselData {
    id: string
    name: string
}

export function EquipmentManagementPageClient({ slug, role }: { slug: string; role: Role }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const { equipments } = useEquipmentWithItems()
    const equipmentId = searchParams.get('equipmentId')

    const [vessel, setVessel] = useState<VesselData | null>(null)
    const [className, setClassName] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const { currentValue: selectedItems, setCurrentValue: setSelectedItems, hasChanges, resetInitial } = useChanges<string>([])
    const [equipmentName, setEquipmentName] = useState<string>('')

    useEffect(() => {
        async function fetchVessel() {
            setLoading(true)
            const { data: vesselData, error: vesselError } = await supabase
                .from('vessels')
                .select('*')
                .eq('slug', slug)
                .single()

            if (vesselError || !vesselData) {
                setLoading(false)
                return
            }

            setVessel(vesselData)

            // Fetch class name
            const { data: classData } = await supabase
                .from('class_of_vessel')
                .select('name')
                .eq('id', vesselData.class_of_vessel)
                .single()

            if (classData) {
                setClassName(classData.name)
            }

            setLoading(false)
        }

        fetchVessel()
    }, [slug, supabase])

    // Fetch equipment name when equipmentId is available
    useEffect(() => {
        if (equipmentId && equipments.length > 0) {
            const equipment = equipments.find(e => e.id === equipmentId)
            if (equipment) {
                // Convert to sentence case
                const sentenceCase = equipment.name
                    .toLowerCase()
                    .replace(/(^\w|\s\w)/g, letter => letter.toUpperCase())
                setEquipmentName(sentenceCase)
            }
        }
    }, [equipmentId, equipments])

    const handleCancel = () => {
        // Remove the last segment (equipment slug) from pathname
        const pathSegments = pathname.split('/')
        pathSegments.pop()
        const equipmentPath = pathSegments.join('/')

        if (equipmentId) {
            router.push(`${equipmentPath}?equipmentId=${equipmentId}`)
        } else {
            router.push(equipmentPath)
        }
    }

    const handleSave = () => {
        // Remove the last segment (equipment slug) from pathname
        const pathSegments = pathname.split('/')
        pathSegments.pop()
        const equipmentPath = pathSegments.join('/')

        if (equipmentId) {
            router.push(`${equipmentPath}?equipmentId=${equipmentId}`)
        } else {
            router.push(equipmentPath)
        }
    }

    // Sync initial state when equipmentId changes
    useEffect(() => {
        resetInitial([])
    }, [equipmentId, resetInitial])

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-foreground/10 w-48" />
                    <div className="h-[400px] bg-foreground/5" />
                </div>
            </div>
        )
    }

    if (!vessel) {
        return (
            <div className="p-4">
                <div className=" bg-surface border border-foreground/10 p-3 text-center shadow-card">
                    <p className="text-foreground-muted text-sm">Vessel '{slug}' not found. Please ask Admin to register this vessel first.</p>
                    <button
                        onClick={handleCancel}
                        className="mt-4 px-4 py-2.5 bg-accent text-white text-xs font-bold uppercase tracking-widest hover:bg-secondary-hover transition-colors"
                    >
                        Back to Equipments
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col min-h-[calc(100vh-2rem)]">
            {/* ── Header ── */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={handleCancel}
                    className="p-2 text-foreground-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                    aria-label="Back to equipments"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-[20px] font-semibold text-foreground leading-tight">
                        {vessel.bow_number}
                    </h1>
                    {equipmentName && (
                        <p className="text-sm text-foreground-muted mt-1">
                            {equipmentName} Management
                        </p>
                    )}
                    {className && !equipmentName && (
                        <p className="text-sm text-foreground-muted mt-1">{className}</p>
                    )}
                </div>
            </div>

            {/* ── Equipment Management Card ── */}
            <div className=" bg-surface border border-foreground/10 overflow-hidden flex-1 flex flex-col shadow-card">
                <div className="p-4">
                    <h2 className="text-[20px] font-semibold text-foreground mb-3">
                        {equipmentName ? `${equipmentName} Management` : 'Equipment Management'}
                    </h2>

                    {/* Equipment items list with checkboxes */}
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-foreground/5 flex items-center justify-center mb-4">
                            <ShieldCheck className="w-8 h-8 text-foreground/15" />
                        </div>
                        <p className="text-foreground-muted text-sm font-medium">No items</p>
                        <p className="text-foreground/40 text-xs mt-1">No items available to assign</p>
                    </div>

                    {/* Save and Cancel buttons */}
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-foreground/5">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges()}
                            className="px-4 py-2.5 bg-accent text-white hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
