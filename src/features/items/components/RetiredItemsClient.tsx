'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MoreVertical, Archive, LayoutList, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { getAccessToken } from '@/lib/auth'

interface Item {
    id: string
    unique_code: string
    classification: string
    nomenclature: string
    is_status: 'active' | 'retired'
    vessel_id: string | null
    vessel?: {
        bow_number: string
    }
}

interface RetiredItemsClientProps {
    role?: 'admin' | 'encoder' | 'viewer'
}

export function RetiredItemsClient({ role }: RetiredItemsClientProps) {
    const [activeTab, setActiveTab] = useState<'retired' | 'unassigned'>('retired')
    const [retiredItems, setRetiredItems] = useState<Item[]>([])
    const [unassignedItems, setUnassignedItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [itemToRetire, setItemToRetire] = useState<Item | null>(null)

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

    const supabase = createClient()

    const fetchItems = async () => {
        setLoading(true)
        try {
            console.log('[RetiredItems] Fetching items...')

            // 1. Fetch Retired items (includes ALL vessels including HLCF/HQ inventory)
            const { data: retiredData, error: retiredError } = await supabase
                .from('items')
                .select(`
                    id, 
                    unique_code, 
                    classification, 
                    nomenclature, 
                    is_status, 
                    vessel_id,
                    vessels!vessel_id (bow_number)
                `)
                .eq('is_status', 'retired')
                .order('updated_at', { ascending: false })

            if (retiredError) {
                console.error('[RetiredItems] Retired Data Error:', retiredError)
            }

            // 2. Fetch Unassigned items — only Bow-vessel items with no assignment.
            //    Include OLCF6/HQ items if they appear in the masterlist but have no vessel assignment.

            // First get HQ vessel ID
            const { data: hqVessel } = await supabase
                .from('vessels')
                .select('id')
                .eq('slug', 'hq-inventory')
                .single()

            let unassignedQuery = supabase
                .from('items')
                .select(`
                    id, 
                    unique_code, 
                    classification, 
                    nomenclature, 
                    is_status, 
                    vessel_id,
                    vessels!vessel_id (bow_number)
                `)
                .eq('is_status', 'active')
                .is('vessel_id', null)

            const { data: unassignedData, error: unassignedError } = await unassignedQuery
                .order('unique_code', { ascending: true })

            if (unassignedError) {
                console.error('[RetiredItems] Unassigned Data Error:', unassignedError)
            }

            console.log('[RetiredItems] Retired Data Count:', retiredData?.length || 0)
            console.log('[RetiredItems] Unassigned Data Count:', unassignedData?.length || 0)

            setRetiredItems((retiredData || []).map((item: any) => ({
                ...item,
                vessel: Array.isArray(item.vessels) ? item.vessels[0] : item.vessels
            })))
            setUnassignedItems((unassignedData || []).map((item: any) => ({
                ...item,
                vessel: Array.isArray(item.vessels) ? item.vessels[0] : item.vessels
            })))
        } catch (error) {
            console.error('[RetiredItems] Unexpected Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const getDisplayBow = (item: Item) => {
        if (item.vessel?.bow_number) return item.vessel.bow_number

        // Extract potential bow number from unique_code for unassigned items
        if (item.unique_code) {
            const parts = item.unique_code.split('-')
            // Typical format: EQUIP-BOW-SEQ or TYPE-BOW-SEQ
            if (parts.length >= 2) {
                return parts[1]
            }
        }

        return 'UNASSIGNED'
    }

    const toggleMenu = (id: string, e: React.MouseEvent) => {
        if (role === 'viewer') return
        e.stopPropagation()
        if (openMenuId === id) {
            setOpenMenuId(null)
            setMenuPosition(null)
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setOpenMenuId(id)
            // Position the menu below the button, aligned to the right
            setMenuPosition({
                top: rect.bottom + window.scrollY,
                left: rect.right - 200 + window.scrollX // 200 is min-width
            })
        }
    }

    useEffect(() => {
        fetchItems()

        const handleScrollOrResize = () => {
            setOpenMenuId(null)
            setMenuPosition(null)
        }
        const handleClickOutside = () => {
            setOpenMenuId(null)
            setMenuPosition(null)
        }

        window.addEventListener('click', handleClickOutside)
        window.addEventListener('scroll', handleScrollOrResize)
        window.addEventListener('resize', handleScrollOrResize)

        return () => {
            window.removeEventListener('click', handleClickOutside)
            window.removeEventListener('scroll', handleScrollOrResize)
            window.removeEventListener('resize', handleScrollOrResize)
        }
    }, [])

    const handleDeclareRetired = async () => {
        if (!itemToRetire) return

        setActionLoading(itemToRetire.id)
        setIsConfirmModalOpen(false)

        try {
            const token = await getAccessToken()
            if (!token) throw new Error('Not authenticated')

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-item-status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                    'X-Custom-Auth': `Bearer ${token}`,
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    itemId: itemToRetire.id,
                    is_status: 'retired'
                })
            })

            const result = await response.json()
            if (!response.ok) {
                console.error('[RetiredItems] Action Failed:', result)
                throw new Error(result.error || result.details || 'Failed to retire item')
            }

            setSuccessMessage(`Item ${itemToRetire.unique_code} has been moved to Unserviceable items.`)
            setIsSuccessModalOpen(true)

            // Refetch or update state locally
            setUnassignedItems(prev => prev.filter(i => i.id !== itemToRetire.id))
            setRetiredItems(prev => [
                { ...itemToRetire, ...result },
                ...prev
            ])

        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setActionLoading(null)
            setItemToRetire(null)
            setOpenMenuId(null)
        }
    }



    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-primary/20">
                <button
                    onClick={() => setActiveTab('retired')}
                    className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'retired'
                        ? 'text-primary bg-primary/5'
                        : 'text-foreground-muted hover:text-primary hover:bg-primary/5'
                        }`}
                >
                    <Archive className="w-4 h-4" />
                    Unserviceable items
                    {activeTab === 'retired' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />}
                </button>
                {role !== 'viewer' && (
                    <button
                        onClick={() => setActiveTab('unassigned')}
                        className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'unassigned'
                            ? 'text-primary bg-primary/5'
                            : 'text-foreground-muted hover:text-primary hover:bg-primary/5'
                            }`}
                    >
                        <LayoutList className="w-4 h-4" />
                        Unassigned Items
                        {activeTab === 'unassigned' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />}
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="bg-surface border border-primary/10 shadow-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Loading Manifest...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-primary/5 border-b border-primary/10">
                                    <th className="px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Unique Code</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Classification</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Nomenclature</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Bow Number</th>
                                    {activeTab === 'unassigned' && (
                                        <th className="px-6 py-4 text-[10px] font-bold text-primary uppercase tracking-[0.2em] text-center">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/5">
                                {(activeTab === 'retired' ? retiredItems : unassignedItems).length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === 'unassigned' ? 6 : 5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-40">
                                                <Archive className="w-12 h-12 text-primary/40 mb-2" />
                                                <p className="text-xs font-bold uppercase tracking-widest text-primary">No Items Found</p>
                                                <p className="text-[10px] uppercase tracking-wider text-foreground-muted">System reports all items accounted for.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    (activeTab === 'retired' ? retiredItems : unassignedItems).map((item) => (
                                        <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className={`text-[9px] font-black px-2 py-0.5 uppercase tracking-widest border text-center block ${item.is_status === 'retired'
                                                    ? 'bg-error/10 text-error border-error/20'
                                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                    }`}>
                                                    {item.is_status === 'retired' ? 'UNSERVICEABLE' : 'UNASSIGNED'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-primary tracking-wider">{item.unique_code}</td>
                                            <td className="px-6 py-4 text-xs text-foreground uppercase tracking-wide">{item.classification}</td>
                                            <td className="px-6 py-4 text-xs text-foreground uppercase tracking-wide">{item.nomenclature}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary uppercase tracking-widest border border-primary/20">
                                                    {getDisplayBow(item)}
                                                </span>
                                            </td>
                                            {activeTab === 'unassigned' && (
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={(e) => toggleMenu(item.id, e)}
                                                        className="p-2 hover:bg-primary/10 text-primary transition-colors inline-flex border border-transparent hover:border-primary/20"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Floating Actions Menu */}
            {openMenuId && menuPosition && (
                <div
                    className="fixed z-[9999] bg-surface border border-primary/20 shadow-xl overflow-hidden min-w-[200px]"
                    style={{
                        top: menuPosition.top - window.scrollY,
                        left: menuPosition.left - window.scrollX
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {role !== 'viewer' && unassignedItems.find(i => i.id === openMenuId) && (
                        <button
                            onClick={() => {
                                setItemToRetire(unassignedItems.find(i => i.id === openMenuId) || null)
                                setIsConfirmModalOpen(true)
                                setOpenMenuId(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-error hover:bg-error/5 transition-colors border-l-2 border-transparent hover:border-error"
                        >
                            <Archive className="w-4 h-4" />
                            Declare Unserviceable item
                        </button>
                    )}
                </div>
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false)
                    setItemToRetire(null)
                }}
                onConfirm={handleDeclareRetired}
                title="Confirm Unserviceable Status"
                message={`Are you sure you want to mark item ${itemToRetire?.unique_code} as unserviceable? This will mark it as decommissioned and remove it from the active inventory manifest.`}
                confirmText="Confirm Status"
                cancelText="Cancel"
            />

            {/* Success Modal */}
            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                title="Unserviceable Item Recorded"
                message={successMessage}
            />
        </div>
    )
}
