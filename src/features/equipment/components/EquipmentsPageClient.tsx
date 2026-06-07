'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Role, ROLES } from '@/lib/types/roles'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser } from '@/lib/auth'
import { useEquipments } from '../hooks/useEquipments'
import { useEquipmentUniqueCode } from '../hooks/useEquipmentUniqueCode'
import { useEquipmentItems, Item } from '../hooks/useEquipmentItems'
import { Plus, Pencil, Trash2, X, Settings, ArrowLeft, Wrench, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportItemsModal } from './ImportItemsModal'
import { getEquipmentGroupFromUniqueCode, getEquipmentGroupLabel, isNavigationalGroup, EquipmentGroup } from '../utils/equipmentGroup'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'

/**  Map each equipment group to its header banner photo */
const EQUIPMENT_BANNERS: Record<EquipmentGroup, string> = {
    WEAPONS: '/images/banners/banner-weapons.webp',
    COMMUNICATION: '/images/banners/banner-communication.webp',
    NAVIGATIONAL: '/images/banners/banner-navigational.webp',
    ICT: '/images/banners/banner-it.webp',
    AMMUNITIONS: '/images/banners/banner-ammunition.webp',
}

export function EquipmentsPageClient({ role, basePath }: { role: Role, basePath: string }) {
    const router = useRouter()
    const { equipments, loading, error, manageEquipment } = useEquipments()
    const { validateUniqueCode, loading: validating } = useEquipmentUniqueCode()
    const canEdit = role === ROLES.admin || role === ROLES.encoder

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [currentEquipment, setCurrentEquipment] = useState<{ id?: string, name?: string, unique_code?: string } | null>(null)
    const [modalError, setModalError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [uniqueCodeError, setUniqueCodeError] = useState<string | null>(null)
    const [selectedEquipment, setSelectedEquipment] = useState<{ id: string, name: string, unique_code?: string } | null>(null)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [importModalEquipmentId, setImportModalEquipmentId] = useState<string | null>(null)
    const [importModalEquipmentName, setImportModalEquipmentName] = useState<string | null>(null)
    const [importModalEquipmentUniqueCode, setImportModalEquipmentUniqueCode] = useState<string | null>(null)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [equipmentToDelete, setEquipmentToDelete] = useState<{ id: string, name: string } | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const { items, loading: itemsLoading, error: itemsError } = useEquipmentItems(selectedEquipment?.id || null)
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false)
    const [isClearing, setIsClearing] = useState(false)

    // Group items by equipment group
    const groupedItems = useMemo(() => {
        if (!selectedEquipment || items.length === 0) return {}

        const group = getEquipmentGroupFromUniqueCode(selectedEquipment.unique_code)
        return {
            [group]: items
        }
    }, [selectedEquipment, items])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentEquipment?.name) return
        if (uniqueCodeError) return

        setIsSaving(true)
        setModalError(null)
        try {
            if (currentEquipment.id) {
                await manageEquipment('update', { id: currentEquipment.id, name: currentEquipment.name, unique_code: currentEquipment.unique_code })
            } else {
                await manageEquipment('create', { name: currentEquipment.name, unique_code: currentEquipment.unique_code })
            }
            setIsModalOpen(false)
            setCurrentEquipment(null)
            setUniqueCodeError(null)
        } catch (err: any) {
            setModalError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        setEquipmentToDelete({ id, name })
        setIsDeleteModalOpen(true)
    }

    const confirmDelete = async () => {
        if (!equipmentToDelete) return

        try {
            // Check if equipment has items before deletion
            const supabase = createClient()
            const { data: itemsData, error: itemsError } = await supabase
                .from('items')
                .select('id')
                .eq('equipment_id', equipmentToDelete.id)
                .limit(1)

            if (itemsError) throw itemsError

            if (itemsData && itemsData.length > 0) {
                setErrorMessage('The Equipment already contains Items, Action cannot be done')
                setIsDeleteModalOpen(false)
                return
            }

            await manageEquipment('delete', { id: equipmentToDelete.id })
            setIsDeleteModalOpen(false)
            setEquipmentToDelete(null)
        } catch (err: any) {
            setErrorMessage(err.message)
            setIsDeleteModalOpen(false)
        }
    }

    const handleCardClick = (equipment: { id: string, name: string }) => {
        setSelectedEquipment(equipment)
    }

    const handleUniqueCodeChange = async (value: string) => {
        setCurrentEquipment(prev => ({ ...prev, unique_code: value }))
        setUniqueCodeError(null)

        if (value && value.trim()) {
            try {
                const result = await validateUniqueCode(value.trim(), currentEquipment?.id)
                if (!result.valid) {
                    setUniqueCodeError(result.message)
                } else if (!result.unique) {
                    setUniqueCodeError(result.message)
                }
            } catch (err: any) {
                setUniqueCodeError(err.message)
            }
        }
    }

    const handleClearAllItems = async () => {
        setIsClearing(true)
        try {
            const supabase = createClient()
            const user = await getAuthUser()
            if (!user) throw new Error('Not authenticated')

            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-all-items`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to clear items')
            }

            setIsClearAllModalOpen(false)
            // Refresh the page to reflect changes
            router.refresh()
        } catch (err: any) {
            setErrorMessage(err.message)
        } finally {
            setIsClearing(false)
        }
    }

    const ItemTable = ({ items, group }: { items: Item[], group: EquipmentGroup }) => {
        const isNavigational = isNavigationalGroup(group)
        const dateColumnLabel = isNavigational ? 'Date Issued' : 'Date Installed'
        const isAmmunition = selectedEquipment?.unique_code?.startsWith('AM') || false

        if (items.length === 0) {
            return (
                <div className="text-center py-4 text-foreground-muted">
                    No items found for this equipment group.
                </div>
            )
        }

        return (
            <div className="border-t border-foreground/10 first:border-0">
                <table className="w-full relative border-collapse">
                    <thead className="sticky top-0 bg-surface z-10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                        <tr className="bg-foreground/5">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Unique Code</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Classification</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Nomenclature</th>
                            {!isAmmunition && (
                                <>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Brand</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Model</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Serial Number</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Part Number</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Date Manufactured</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">{dateColumnLabel}</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">ICS</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">PAR</th>
                                </>
                            )}
                            {isAmmunition && (
                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Quantity</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-foreground/5 hover:bg-foreground/2">
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.unique_code || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                                {!isAmmunition && (
                                    <>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_manufactured) || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.ics || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.par || '-'}</td>
                                    </>
                                )}
                                {isAmmunition && (
                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.quantity || '-'}</td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    if (selectedEquipment) {
        const group = getEquipmentGroupFromUniqueCode(selectedEquipment.unique_code)
        const groupLabel = getEquipmentGroupLabel(group)

        return (
            <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)] min-h-0">
                <PageHeader
                    title={groupLabel}
                    description={`Viewing items for ${selectedEquipment.name}`}
                    subtitle="Equipment Classification"
                    onBack={() => setSelectedEquipment(null)}
                    bannerImage={EQUIPMENT_BANNERS[group]}
                />

                <div className="bg-surface border border-foreground/10 overflow-hidden shadow-card flex flex-col flex-1 min-h-0 mx-4 md:mx-0">
                    <div className="p-4 border-b border-foreground/10 bg-foreground/3 shrink-0">
                        <h1 className="text-[20px] font-semibold text-foreground flex items-center gap-3">
                            <Settings className="w-6 h-6 text-accent" />
                            {selectedEquipment.name}
                            {selectedEquipment.unique_code && (
                                <span className="text-foreground-muted font-normal">- {selectedEquipment.unique_code}</span>
                            )}
                        </h1>
                    </div>
                    <div className="p-4 flex flex-col flex-1 min-h-0">
                        {itemsLoading ? (
                            <div className="text-center py-4 text-foreground-muted">Loading items...</div>
                        ) : itemsError ? (
                            <div className="text-center py-4 text-error">Error: {itemsError}</div>
                        ) : Object.keys(groupedItems).length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-4">
                                <div className="w-24 h-24 bg-foreground/5 flex items-center justify-center mb-3">
                                    <Settings className="w-8 h-8 text-foreground-muted" />
                                </div>
                                <h2 className="text-[20px] font-semibold text-foreground mb-2">No Items Found</h2>
                                <p className="text-foreground-muted max-w-md">
                                    No items have been added to {selectedEquipment.name} yet.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-auto flex-1 h-full pr-2">
                                {Object.entries(groupedItems).map(([group, groupItems]) => (
                                    <div key={group} className=" bg-surface border border-foreground/10 overflow-hidden shadow-card">
                                        <ItemTable items={groupItems} group={group as EquipmentGroup} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <ImportItemsModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    equipmentId={selectedEquipment.id}
                    equipmentName={selectedEquipment.name}
                    equipmentUniqueCode={selectedEquipment.unique_code}
                    onImportComplete={() => {
                        // Refresh data if needed
                        setIsImportModalOpen(false)
                    }}
                />
            </div >
        )
    }

    if (loading) return <div className="p-4 text-foreground">Loading equipments...</div>
    if (error) return <div className="p-4 text-error">Error: {error}</div>

    return (
        <div className="space-y-6">
            <PageHeader
                title="Equipment Management"
                description="Manage and Group items by equipment"
                onBack={() => router.push(basePath)}
                Icon={Wrench}
                actions={
                    <div className="flex gap-3">
                        {(role === ROLES.admin || role === ROLES.encoder) && (
                            <button
                                onClick={() => setIsClearAllModalOpen(true)}
                                className="bg-error text-white px-4 py-2.5 flex items-center gap-2 hover:bg-error/90 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                            >
                                <Trash2 className="w-4 h-4" /> Clear All Items (Dev)
                            </button>
                        )}
                        {canEdit && (
                            <>
                                <button
                                    onClick={() => {
                                        setImportModalEquipmentId(null)
                                        setImportModalEquipmentName(null)
                                        setImportModalEquipmentUniqueCode(null)
                                        setIsImportModalOpen(true)
                                    }}
                                    className="bg-accent text-white px-6 py-2.5 flex items-center gap-2 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                >
                                    <Plus className="w-4 h-4" /> Update Masterlist
                                </button>
                                <button
                                    onClick={() => { setCurrentEquipment({}); setModalError(null); setIsModalOpen(true) }}
                                    className="bg-accent text-white px-6 py-2.5 flex items-center gap-2 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                >
                                    <Plus className="w-4 h-4" /> Add Equipment
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* PRE-DEFINED EQUIPMENTS */}
            {(() => {
                const predefined = equipments.filter(eq => eq.is_predefined)
                const custom = equipments.filter(eq => !eq.is_predefined)
                return (
                    <>
                        {predefined.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-3">
                                {predefined.map(equipment => (
                                    <div
                                        key={equipment.id}
                                        onClick={() => handleCardClick(equipment)}
                                        className="w-full md:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] bg-surface border border-accent/30 p-4 hover:border-accent/60 hover:shadow-card transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-8 h-8 bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                                                <Settings className="w-6 h-6 text-accent" />
                                            </div>
                                            {/* Code badge */}
                                            <span className="text-xs font-bold text-accent border border-accent/30 px-2 py-0.5 bg-accent/5 tracking-widest mt-1 mr-10">{equipment.unique_code}</span>
                                        </div>
                                        <h3 className="text-[18px] font-semibold text-foreground mb-1">{equipment.name}</h3>
                                        <p className="text-xs text-foreground-muted uppercase tracking-wider">{equipment.unique_code} · Click to view items</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Divider before custom */}
                        {custom.length > 0 && (
                            <div className="w-full">
                                <div className="flex items-center gap-2 mb-3 mt-2">
                                    <Wrench className="w-4 h-4 text-foreground-muted" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Custom Equipment</span>
                                    <div className="flex-1 h-px bg-foreground/10" />
                                </div>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {custom.map(equipment => (
                                        <div
                                            key={equipment.id}
                                            onClick={() => handleCardClick(equipment)}
                                            className="w-full md:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] bg-surface border border-foreground/10 p-4 hover:border-foreground/30 hover:shadow-card transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-8 h-8 bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                                                    <Settings className="w-6 h-6 text-accent" />
                                                </div>
                                                {canEdit && (
                                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => { setCurrentEquipment(equipment); setModalError(null); setIsModalOpen(true) }}
                                                            className="text-foreground-muted hover:text-foreground p-1.5 hover:bg-foreground/5 transition-colors"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(equipment.id, equipment.name)}
                                                            className="text-foreground-muted hover:text-error p-1.5 hover:bg-error-bg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="text-[18px] font-semibold text-foreground mb-1">
                                                {equipment.name}
                                                {equipment.unique_code && (
                                                    <span className="ml-2 text-xs text-foreground-muted font-normal">[{equipment.unique_code}]</span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-foreground-muted">Click to view classification</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {equipments.length === 0 && (
                            <div className="w-full py-3 text-center text-foreground-muted bg-surface border border-foreground/10 shadow-card">
                                No equipments found. {canEdit && 'Click "Add Equipment" to create one.'}
                            </div>
                        )}
                    </>
                )
            })()}

            <ImportItemsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                equipmentId={importModalEquipmentId || ''}
                equipmentName={importModalEquipmentName || 'All Equipments'}
                equipmentUniqueCode={importModalEquipmentUniqueCode || undefined}
                onImportComplete={() => {
                    setIsImportModalOpen(false)
                }}
            />

            {/* ADD/EDIT MODAL */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                            <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                                <h3 className="font-semibold text-[20px] text-foreground">
                                    {currentEquipment?.id ? 'Edit Equipment' : 'Add Equipment'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="p-3 space-y-4">
                                {modalError && <div className="text-sm text-error bg-error-bg p-3">{modalError}</div>}
                                <div>
                                    <label className="block text-sm font-medium text-foreground-muted mb-1.5">Equipment Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-foreground/15 px-4 py-2.5 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                        placeholder="Enter equipment name"
                                        value={currentEquipment?.name || ''}
                                        onChange={e => setCurrentEquipment(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground-muted mb-1.5">Equipment Type Code</label>
                                    <input
                                        type="text"
                                        className={`w-full border px-4 py-2.5 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:border-primary transition-colors ${uniqueCodeError ? 'border-error focus:ring-error/40' : 'border-foreground/15 focus:ring-primary/40'}`}
                                        placeholder="e.g., WE, CE, NE, IE, AM"
                                        value={currentEquipment?.unique_code || ''}
                                        onChange={e => handleUniqueCodeChange(e.target.value)}
                                        disabled={validating}
                                    />
                                    {uniqueCodeError && (
                                        <p className="text-xs text-error mt-1">{uniqueCodeError}</p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-accent text-white hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card">
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* DELETE CONFIRMATION MODAL */}
            {
                isDeleteModalOpen && equipmentToDelete && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                            <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                                <h3 className="font-semibold text-[20px] text-foreground">Delete Equipment</h3>
                                <button onClick={() => { setIsDeleteModalOpen(false); setEquipmentToDelete(null) }} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-3 space-y-4">
                                <p className="text-foreground text-sm">
                                    Are you sure you want to delete <span className="font-semibold">{equipmentToDelete.name}</span>? This action cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => { setIsDeleteModalOpen(false); setEquipmentToDelete(null) }}
                                        className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="px-4 py-2.5 bg-error text-white hover:bg-error/90 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ERROR MESSAGE MODAL */}
            {
                errorMessage && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                            <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                                <h3 className="font-semibold text-[20px] text-foreground">Action Cannot Be Done</h3>
                                <button onClick={() => setErrorMessage(null)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-3 space-y-4">
                                <p className="text-foreground text-sm">{errorMessage}</p>
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={() => setErrorMessage(null)}
                                        className="px-6 py-2.5 bg-accent text-white hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CLEAR ALL ITEMS CONFIRMATION MODAL */}
            {
                isClearAllModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                            <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                                <h3 className="font-semibold text-[20px] text-foreground">Clear All Items (Dev Tool)</h3>
                                <button onClick={() => setIsClearAllModalOpen(false)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-3 space-y-4">
                                <p className="text-foreground text-sm">
                                    This will <span className="font-semibold text-error">permanently delete</span> all items and vessel assignments from the system. This action cannot be undone.
                                </p>
                                <p className="text-foreground-muted text-sm">
                                    This is a development tool for testing purposes.
                                </p>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => setIsClearAllModalOpen(false)}
                                        disabled={isClearing}
                                        className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleClearAllItems}
                                        disabled={isClearing}
                                        className="px-4 py-2.5 bg-error text-white hover:bg-error/90 disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                    >
                                        {isClearing ? 'Clearing...' : 'Clear All Items'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
