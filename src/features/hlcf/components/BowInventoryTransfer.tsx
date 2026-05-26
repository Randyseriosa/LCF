'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowRight, Search, ChevronDown, X } from 'lucide-react'
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
    const [previewing, setPreviewing] = useState(false)
    const [previewItems, setPreviewItems] = useState<any[]>([])
    const [customCodes, setCustomCodes] = useState<Record<string, string>>({})
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [transferredItems, setTransferredItems] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isItemsDropdownOpen, setIsItemsDropdownOpen] = useState(false)

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
        if (vId) setIsItemsDropdownOpen(true)
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

    const filteredSourceItems = sourceItems.filter(si =>
        (si.item.nomenclature || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (si.item.unique_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const isAllFilteredSelected = filteredSourceItems.length > 0 && filteredSourceItems.every(si => selectedItemIds.has(si.item.id))

    const handleSelectAll = () => {
        const newKeys = new Set(selectedItemIds)
        if (isAllFilteredSelected) {
            filteredSourceItems.forEach(si => newKeys.delete(si.item.id))
        } else {
            filteredSourceItems.forEach(si => newKeys.add(si.item.id))
        }
        setSelectedItemIds(newKeys)
    }

    const handlePreview = async () => {
        if (!sourceVesselId || !targetVesselId || selectedItemIds.size === 0) return
        if (sourceVesselId === targetVesselId) {
            setError('Cannot transfer to the same vessel')
            return
        }

        setPreviewing(true)
        setError(null)
        setSuccessMsg(null)
        setTransferredItems([])
        setPreviewItems([])
        setCustomCodes({})

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
                    action: 'preview',
                    vesselId: targetVesselId,
                    selectedIds: Array.from(selectedItemIds)
                })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Preview failed')

            setPreviewItems(result.data?.items || [])
            const initialCodes: Record<string, string> = {}
                ; (result.data?.items || []).forEach((item: any) => {
                    initialCodes[item.item_id] = item.new_unique_code
                })
            setCustomCodes(initialCodes)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setPreviewing(false)
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
                    selectedIds: Array.from(selectedItemIds),
                    customCodes
                })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Transfer failed')

            const targetBow = vessels.find(v => v.id === targetVesselId)?.bow_number || 'Recipient'
            const count = result.data?.transferred || 0

            setSuccessMsg(`Successfully transferred ${count} items to ${targetBow}`)

            if (result.data?.items) {
                setTransferredItems(result.data.items)
            } else {
                setTransferredItems([])
            }

            setPreviewItems([])
            setCustomCodes({})

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
            <div className="flex-1 bg-surface border border-foreground/5 shadow-card p-4 h-[500px] flex flex-col">
                <h3 className="text-foreground font-semibold text-[16px] mb-4 uppercase tracking-widest">Source Bow</h3>
                <SearchableSelect
                    value={sourceVesselId}
                    onChange={(val) => setSourceVesselId(val)}
                    placeholder="-- Select Source Bow Number --"
                    options={vessels.map(v => ({ value: v.id, label: v.bow_number || 'Unnamed' }))}
                    className="mb-4"
                />

                {sourceVesselId && sourceItems.length > 0 && (
                    <div className="mb-4 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsItemsDropdownOpen(!isItemsDropdownOpen)}
                            className="w-full flex items-center justify-between p-3 border border-foreground/10 bg-background text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-foreground/5 transition-colors focus:outline-none"
                        >
                            <span>{isItemsDropdownOpen ? 'Hide Items Search' : `Select Items (${sourceItems.length} available)`}</span>
                            <ChevronDown className={`w-4 h-4 text-foreground-muted transition-transform ${isItemsDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                )}

                {sourceVesselId && isItemsDropdownOpen && sourceItems.length > 0 ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-background border border-foreground/10 flex-shrink overflow-hidden relative">
                        <div className="p-2 border-b border-foreground/10 relative shrink-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                            <input
                                type="text"
                                placeholder="Search items by code or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-foreground/10 bg-background text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                        <div className="flex-1 overflow-auto bg-surface">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-surface z-10 border-b border-foreground/10 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2 text-left w-10">
                                            <input
                                                type="checkbox"
                                                checked={isAllFilteredSelected}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 rounded border-foreground/20 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Code</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSourceItems.length > 0 ? (
                                        filteredSourceItems.map(si => (
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
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-sm text-foreground-muted uppercase tracking-widest">
                                                No matches found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : sourceVesselId ? (
                    loadingItems ? (
                        <div className="flex-1 border border-foreground/10 bg-background relative flex justify-center items-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
                        </div>
                    ) : sourceItems.length === 0 ? (
                        <div className="flex-1 border border-foreground/10 bg-background relative flex items-center justify-center text-center py-8 text-sm text-foreground-muted uppercase tracking-widest">
                            No items in this bow
                        </div>
                    ) : (
                        selectedItemIds.size > 0 ? (
                            <div className="flex-1 flex flex-col min-h-0 bg-background border border-foreground/10">
                                <div className="p-2 border-b border-foreground/10 bg-surface text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">
                                    Selected Items for Transfer
                                </div>
                                <div className="flex-1 overflow-auto p-2 space-y-1 bg-surface">
                                    {sourceItems.filter(si => selectedItemIds.has(si.item.id)).map(si => (
                                        <div key={si.item.id} className="text-xs p-2 bg-background border border-foreground/5 flex justify-between items-center group hover:border-error/20 transition-colors">
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-semibold text-foreground truncate max-w-[200px]" title={si.item.nomenclature || '-'}>{si.item.nomenclature || '-'}</span>
                                                <span className="text-[10px] text-foreground-muted uppercase tracking-widest mt-0.5 truncate">{si.item.unique_code || '-'}</span>
                                            </div>
                                            <button
                                                onClick={() => handleToggleSelect(si.item.id)}
                                                className="text-foreground-muted hover:text-error transition-colors p-1 shrink-0"
                                                title="Remove from selection"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 border border-foreground/10 bg-background relative text-center py-8 text-sm text-foreground-muted uppercase tracking-widest flex items-center justify-center">
                                Expand item list to select
                            </div>
                        )
                    )
                ) : (
                    <div className="flex-1 overflow-auto border border-foreground/10 bg-background relative flex items-center justify-center">
                        <div className="text-center py-8 text-sm text-foreground-muted uppercase tracking-widest">
                            Select a bow to view items
                        </div>
                    </div>
                )}
                <div className="mt-3 text-xs text-foreground-muted font-semibold uppercase tracking-widest shrink-0">
                    Selected: {selectedItemIds.size}
                </div>
            </div>

            {/* MIDDLE COLUMN: Action */}
            <div className="flex md:flex-col items-center justify-center py-4 px-2 self-center gap-3">
                {previewItems.length === 0 ? (
                    <button
                        onClick={handlePreview}
                        disabled={previewing || selectedItemIds.size === 0 || !sourceVesselId || !targetVesselId || sourceVesselId === targetVesselId}
                        className="bg-primary hover:bg-secondary-hover text-background p-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Preview Transfer"
                    >
                        {previewing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <ArrowRight className="w-5 h-5 hidden md:block mx-auto" />}
                        {previewing ? null : <span className="md:hidden font-semibold uppercase tracking-widest text-xs">Preview</span>}
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleTransfer}
                            disabled={transferring}
                            className="bg-primary hover:opacity-90 text-background p-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            title="Confirm Transfer"
                        >
                            {transferring ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="font-semibold uppercase tracking-widest text-xs">Confirm</span>}
                        </button>
                        <button
                            onClick={() => { setPreviewItems([]); setCustomCodes({}); }}
                            disabled={transferring}
                            className="bg-error hover:bg-error-hover text-background p-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            title="Cancel Preview"
                        >
                            <span className="font-semibold uppercase tracking-widest text-xs">Cancel</span>
                        </button>
                    </>
                )}
            </div>

            {/* RIGHT COLUMN: Recipient */}
            <div className="flex-1 bg-surface border border-foreground/5 shadow-card p-4 h-[500px] flex flex-col">
                <h3 className="text-foreground font-semibold text-[16px] mb-4 uppercase tracking-widest">Recipient</h3>
                <SearchableSelect
                    value={targetVesselId}
                    onChange={(val) => setTargetVesselId(val)}
                    placeholder="-- Select Recipient --"
                    options={vessels.map(v => ({ value: v.id, label: v.bow_number || 'Unnamed' }))}
                    className="mb-4"
                />

                <div className="flex-1 flex flex-col border border-foreground/10 bg-background/50 relative overflow-hidden">
                    <div className="p-4 flex flex-col flex-1 overflow-y-auto">
                        {!transferredItems.length && previewItems.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <p className="text-xs text-foreground-muted uppercase tracking-widest">
                                    Select {selectedItemIds.size > 0 ? selectedItemIds.size : 'items'} to preview move to the recipient.
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
                        ) : previewItems.length > 0 ? (
                            <div className="flex flex-col w-full">
                                <h4 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-widest mb-2">Review New Unique Codes</h4>
                                <div className="space-y-2">
                                    {previewItems.map((item, idx) => (
                                        <div key={idx} className="bg-surface p-2 border border-foreground/5 text-xs text-foreground flex flex-col gap-1">
                                            <span className="font-semibold truncate" title={item.nomenclature || '-'}>
                                                {item.nomenclature || '-'}
                                            </span>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <span className="text-[10px] text-foreground-muted uppercase tracking-widest">New Code:</span>
                                                <input
                                                    type="text"
                                                    value={customCodes[item.item_id] || ''}
                                                    onChange={(e) => setCustomCodes({ ...customCodes, [item.item_id]: e.target.value })}
                                                    className="border border-foreground/20 bg-background px-2 py-1 text-xs focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {error && (
                                    <div className="mt-4 p-3 bg-error-bg text-error text-xs font-semibold w-full">
                                        {error}
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
