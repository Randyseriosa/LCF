'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowRight } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

interface Vessel {
    id: string
    bow_number: string
    class_of_vessel: string
}

interface AssignedItem {
    assignment_id: string
    item: {
        id: string
        unique_code: string
        nomenclature: string
        classification: string
    }
}

export function BowInventoryTransfer() {
    const supabase = createClient()
    const [vessels, setVessels] = useState<Vessel[]>([])
    const [sourceVesselId, setSourceVesselId] = useState<string>('')
    const [targetVesselId, setTargetVesselId] = useState<string>('')

    const [sourceItems, setSourceItems] = useState<AssignedItem[]>([])
    const [loadingItems, setLoadingItems] = useState(false)

    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
    const [transferring, setTransferring] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [transferredItems, setTransferredItems] = useState<any[]>([])

    // Fetch all vessels for dropdowns
    useEffect(() => {
        const fetchVessels = async () => {
            const { data } = await supabase
                .from('vessels')
                .select('id, bow_number, class_of_vessel')
                .order('bow_number', { ascending: true })
            if (data) {
                setVessels(data)
            }
        }
        fetchVessels()
    }, [supabase])

    // Fetch items when source vessel changes
    const fetchSourceItems = async (vId: string) => {
        if (!vId) {
            setSourceItems([])
            return
        }
        setLoadingItems(true)
        const { data } = await supabase
            .from('vessel_item_assignments')
            .select('id, items!item_id(id, unique_code, nomenclature, classification)')
            .eq('vessel_id', vId)
            .eq('is_current', true)

        if (data) {
            // Data shape is { id: string, items: object | object[] } based on the join
            // items should be a single object since it's a many-to-one relationship from assignment to item
            const mapped = data
                .filter(d => d.items)
                .map(d => ({
                    assignment_id: d.id,
                    item: Array.isArray(d.items) ? d.items[0] : d.items
                })) as AssignedItem[]

            setSourceItems(mapped)
        }
        setLoadingItems(false)
        setSelectedItemIds(new Set())
    }

    useEffect(() => {
        fetchSourceItems(sourceVesselId)
    }, [sourceVesselId, supabase])

    const handleToggleSelect = (itemId: string) => {
        const newKeys = new Set(selectedItemIds)
        if (newKeys.has(itemId)) newKeys.delete(itemId)
        else newKeys.add(itemId)
        setSelectedItemIds(newKeys)
    }

    const handleSelectAll = () => {
        if (selectedItemIds.size === sourceItems.length) {
            setSelectedItemIds(new Set())
        } else {
            setSelectedItemIds(new Set(sourceItems.map(si => si.item.id)))
        }
    }

    const handleTransfer = async () => {
        if (!sourceVesselId || !targetVesselId || selectedItemIds.size === 0) return
        if (sourceVesselId === targetVesselId) {
            setError('Cannot transfer to the same vessel')
            return
        }

        setTransferring(true)
        setError(null)
        setSuccessMsg(null)
        setTransferredItems([])

        try {
            const user = await getAuthUser()
            if (!user) throw new Error('Not authenticated')

            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-vessel-item-assignment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'transfer',
                    vesselId: targetVesselId,
                    selectedIds: Array.from(selectedItemIds)
                })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Transfer failed')

            const targetBow = vessels.find(v => v.id === targetVesselId)?.bow_number || 'Destination Bow'
            const count = result.data?.transferred || 0

            setSuccessMsg(`Successfully transferred ${count} items to ${targetBow}`)

            if (result.data?.items) {
                setTransferredItems(result.data.items)
            } else {
                setTransferredItems([])
            }

            // Refresh
            fetchSourceItems(sourceVesselId)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setTransferring(false)
        }
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 w-full items-start">
            {/* LEFT COLUMN: Source */}
            <div className="flex-1 bg-surface border border-foreground/5 shadow-card p-4 min-h-[400px] flex flex-col">
                <h3 className="text-foreground font-semibold text-[16px] mb-4 uppercase tracking-widest">Source Bow</h3>
                <SearchableSelect
                    value={sourceVesselId}
                    onChange={(val) => setSourceVesselId(val)}
                    placeholder="-- Select Source Bow Number --"
                    options={vessels.map(v => ({ value: v.id, label: v.bow_number || 'Unnamed' }))}
                    className="mb-4"
                />

                <div className="flex-1 overflow-auto border border-foreground/10 bg-background relative">
                    {loadingItems ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
                        </div>
                    ) : sourceVesselId && sourceItems.length === 0 ? (
                        <div className="text-center py-8 text-sm text-foreground-muted uppercase tracking-widest">
                            No items in this bow
                        </div>
                    ) : sourceVesselId ? (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-surface z-10 border-b border-foreground/10">
                                <tr>
                                    <th className="px-3 py-2 text-left w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedItemIds.size > 0 && selectedItemIds.size === sourceItems.length}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded border-foreground/20 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Code</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sourceItems.map(si => (
                                    <tr key={si.item.id} className="border-b border-foreground/5 hover:bg-secondary/5 transition-colors">
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.has(si.item.id)}
                                                onChange={() => handleToggleSelect(si.item.id)}
                                                className="w-4 h-4 rounded border-foreground/20 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{si.item.unique_code || '-'}</td>
                                        <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap truncate max-w-[150px]">{si.item.nomenclature || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-8 text-sm text-foreground-muted uppercase tracking-widest">
                            Select a bow to view items
                        </div>
                    )}
                </div>
                <div className="mt-3 text-xs text-foreground-muted font-semibold uppercase tracking-widest">
                    Selected: {selectedItemIds.size}
                </div>
            </div>

            {/* MIDDLE COLUMN: Action */}
            <div className="flex md:flex-col items-center justify-center py-4 px-2 self-center">
                <button
                    onClick={handleTransfer}
                    disabled={transferring || selectedItemIds.size === 0 || !sourceVesselId || !targetVesselId || sourceVesselId === targetVesselId}
                    className="bg-primary hover:bg-secondary-hover text-background p-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Transfer Selected Items"
                >
                    {transferring ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 hidden md:block" />}
                    {transferring ? null : <span className="md:hidden font-semibold uppercase tracking-widest">Transfer</span>}
                </button>
            </div>

            {/* RIGHT COLUMN: Destination */}
            <div className="flex-1 bg-surface border border-foreground/5 shadow-card p-4 min-h-[400px] flex flex-col">
                <h3 className="text-foreground font-semibold text-[16px] mb-4 uppercase tracking-widest">Destination Bow</h3>
                <SearchableSelect
                    value={targetVesselId}
                    onChange={(val) => setTargetVesselId(val)}
                    placeholder="-- Select Destination Bow Number --"
                    options={vessels.map(v => ({ value: v.id, label: v.bow_number || 'Unnamed' }))}
                    className="mb-4"
                />

                <div className="flex-1 flex flex-col border border-foreground/10 bg-background/50 relative overflow-hidden">
                    <div className="p-4 flex flex-col flex-1 overflow-y-auto">
                        {!transferredItems.length ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <p className="text-xs text-foreground-muted uppercase tracking-widest">
                                    Select {selectedItemIds.size > 0 ? selectedItemIds.size : 'items'} to move to the destination bow.
                                </p>
                                {error && (
                                    <div className="mt-4 p-3 bg-error-bg text-error text-xs font-semibold w-full">
                                        {error}
                                    </div>
                                )}
                                {successMsg && (
                                    <div className="mt-4 p-3 bg-success-bg text-success text-xs font-semibold w-full">
                                        {successMsg}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col w-full">
                                <div className="p-3 bg-success-bg text-success text-xs font-semibold w-full mb-4">
                                    {successMsg}
                                </div>
                                <h4 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-widest mb-2">Moved Items</h4>
                                <div className="space-y-2">
                                    {transferredItems.map((item, idx) => (
                                        <div key={idx} className="bg-surface p-2 border border-foreground/5 text-xs text-foreground flex flex-col gap-1">
                                            <span className="font-semibold truncate" title={item.nomenclature || '-'}>
                                                {item.nomenclature || '-'}
                                            </span>
                                            <span className="text-foreground-muted text-[10px] break-all">
                                                <span className="line-through mr-1 opacity-70">{item.old_unique_code || '-'}</span>
                                                <span className="text-primary font-semibold">&rarr; {item.new_unique_code || '-'}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
