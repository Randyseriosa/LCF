'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Role } from '@/lib/types/roles'
import { ArrowLeft, Package, ShieldCheck } from 'lucide-react'
import { useEquipmentWithItems } from '@/features/equipment/hooks/useEquipmentWithItems'
import { ManageEquipmentItems } from '@/features/vessels/components/ManageEquipmentItems'
import { getEquipmentGroupFromUniqueCode, isAmmunitionsGroup, getEquipmentGroupLabel } from '@/features/equipment/utils/equipmentGroup'

// Helper function to convert equipment name to URL-friendly slug
const toSlug = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}

interface VesselData {
    id: string
    bow_number: string
    class_of_vessel: string
}

interface ClassOfVesselData {
    id: string
    name: string
}

export function BowEquipmentPageClient({ slug, role }: { slug: string; role: Role }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const [vessel, setVessel] = useState<VesselData | null>(null)
    const [className, setClassName] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [isManageMode, setIsManageMode] = useState(false)
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
    const [showSaveNotification, setShowSaveNotification] = useState(false)

    const { equipments, loading: equipmentsLoading, refresh: refreshEquipments } = useEquipmentWithItems(vessel?.id)

    useEffect(() => {
        const equipmentIdParam = searchParams.get('equipmentId')
        if (equipmentIdParam) {
            setSelectedEquipmentId(equipmentIdParam)
        }
    }, [searchParams])

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


    const handleCancel = () => {
        const vesselsPath = pathname.replace(/\/[^/]+\/equipments.*/, '')
        router.push(`${vesselsPath}?tab=bow`)
    }

    const handleSave = () => {
        const vesselsPath = pathname.replace(/\/[^/]+\/equipments.*/, '')
        router.push(`${vesselsPath}?tab=bow&highlight=${vessel?.id}`)
    }

    if (loading || equipmentsLoading) {
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
                    <p className="text-foreground-muted text-sm">Vessel not found</p>
                    <button
                        onClick={handleCancel}
                        className="mt-4 px-4 py-2.5 bg-accent text-white text-xs font-bold uppercase tracking-widest hover:bg-secondary-hover transition-colors"
                    >
                        Back to Vessels
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
                    aria-label="Back to vessels"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-[20px] font-semibold text-foreground leading-tight">
                        {vessel.bow_number}
                    </h1>
                    {className && (
                        <p className="text-sm text-foreground-muted mt-1">{className}</p>
                    )}
                </div>
            </div>

            {/* ── Equipment Grid Card ── */}
            <div className=" bg-surface border border-foreground/10 overflow-hidden flex-1 flex flex-col shadow-card min-h-0">
                {/* Equipment grid */}
                <div className="p-4 flex flex-col flex-1 min-h-0">
                    {!selectedEquipmentId && (
                        <h2 className="text-[20px] font-semibold text-foreground mb-3">Equipments</h2>
                    )}
                    {!selectedEquipmentId ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {equipments.map((equipment) => (
                                <button
                                    key={equipment.id}
                                    onClick={() => setSelectedEquipmentId(equipment.id)}
                                    className=" bg-surface border border-foreground/10 p-3 hover:border-foreground/30 hover:shadow-card transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                                            <Package className="w-5 h-5 text-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {equipment.name}
                                            </p>
                                            <p className="text-xs text-foreground-muted mt-0.5">
                                                {equipment.items.length} item{equipment.items.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col flex-1 min-h-0">
                            {!isManageMode ? (
                                <>
                                    {/* Tab navigation */}
                                    <div className="flex items-center justify-between mb-3 border-b border-foreground/10">
                                        <button
                                            onClick={() => setSelectedEquipmentId(null)}
                                            className="text-sm text-foreground font-semibold pb-4 flex items-center gap-1 transition-colors border-b-2 border-foreground"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            Back to Equipments
                                        </button>
                                        <button
                                            onClick={() => setIsManageMode(true)}
                                            className="text-sm pb-4 flex items-center gap-1 transition-colors border-b-2 border-transparent text-foreground-muted hover:text-foreground hover:border-foreground/20"
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            Manage
                                        </button>
                                    </div>
                                    {(() => {
                                        const selectedEquipment = equipments.find(e => e.id === selectedEquipmentId)
                                        if (!selectedEquipment) return null

                                        const group = getEquipmentGroupFromUniqueCode(selectedEquipment.unique_code ?? undefined)
                                        const groupLabel = getEquipmentGroupLabel(group)

                                        return (
                                            <div className="flex flex-col flex-1 min-h-0">
                                                <h3 className="text-md font-semibold text-foreground mb-4 shrink-0 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-primary" />
                                                    {selectedEquipment.name}
                                                </h3>
                                                {selectedEquipment.items.length > 0 ? (
                                                    <div className="overflow-auto flex-1 border border-foreground/10">
                                                        {(() => {
                                                            const isAmmo = isAmmunitionsGroup(getEquipmentGroupFromUniqueCode(selectedEquipment.unique_code ?? undefined))
                                                            return (
                                                                <table className="w-full relative">
                                                                    <thead className="sticky top-0 bg-surface z-10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                                                                        <tr className="border-b border-foreground/10">
                                                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Unique Code</th>
                                                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Classification</th>
                                                                            <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Nomenclature</th>
                                                                            {isAmmo ? (
                                                                                <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Quantity</th>
                                                                            ) : (
                                                                                <>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Brand</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Model</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Serial Number</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Part Number</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Date Manufactured</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">Date Installed</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">ICS</th>
                                                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-foreground">PAR</th>
                                                                                </>
                                                                            )}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {selectedEquipment.items.map((item) => (
                                                                            <tr
                                                                                key={item.id}
                                                                                className="border-b border-foreground/5 hover:bg-foreground/3 transition-colors"
                                                                            >
                                                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.unique_code || '-'}</td>
                                                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                                                                <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                                                                                {isAmmo ? (
                                                                                    <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.quantity ?? '-'}</td>
                                                                                ) : (
                                                                                    <>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.date_manufactured || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.date_installed_issued || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                                                                        <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                                                                    </>
                                                                                )}
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                        <div className="w-16 h-16 bg-foreground/5 flex items-center justify-center mb-4">
                                                            <Package className="w-8 h-8 text-foreground/15" />
                                                        </div>
                                                        <p className="text-foreground-muted text-sm font-medium">No items</p>
                                                        <p className="text-foreground/40 text-xs mt-1">No items added to this equipment category</p>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </>
                            ) : (
                                <ManageEquipmentItems
                                    vesselId={vessel.id}
                                    equipmentId={selectedEquipmentId}
                                    equipmentName={equipments.find(e => e.id === selectedEquipmentId)?.name || ''}
                                    onBack={() => {
                                        setIsManageMode(false)
                                        refreshEquipments()
                                        setShowSaveNotification(true)
                                        setTimeout(() => setShowSaveNotification(false), 3000)
                                    }}
                                />
                            )}
                        </div>
                    )}
                    {equipments.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 bg-foreground/5 flex items-center justify-center mb-4">
                                <Package className="w-8 h-8 text-foreground/15" />
                            </div>
                            <p className="text-foreground-muted text-sm font-medium">No equipment</p>
                            <p className="text-foreground/40 text-xs mt-1">Equipment data will appear here</p>
                        </div>
                    )}
                </div>
            </div>

            {showSaveNotification && (
                <div className="fixed top-4 right-4 bg-accent text-white px-6 py-3 shadow-popover text-xs font-bold uppercase tracking-widest z-50 animate-slide-in-right">
                    Saved Changes
                </div>
            )}
        </div>
    )
}
