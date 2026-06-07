'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImportItemsModal } from '@/features/equipment/components/ImportItemsModal'
import { Inbox, Plus } from 'lucide-react'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'

interface Item {
    id: string
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
    equipments?: {
        name: string
        unique_code: string
    }
}

export function MasterListTab() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isClearing, setIsClearing] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    const fetchItems = async () => {
        setLoading(true)
        setError(null)
        try {
            const supabase = createClient()
            const { data, error: fetchError } = await supabase
                .from('items')
                .select('*, equipments(name, unique_code)')
                .ilike('unique_code', '%-OLCF6-%')
                .order('unique_code', { ascending: true })

            if (fetchError) throw fetchError
            setItems(data || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleClearAll = async () => {
        if (!window.confirm('ARE YOU SURE YOU WANT TO CLEAR ALL HQ INVENTORY ITEMS? THIS ACTION CANNOT BE UNDONE.')) {
            return
        }

        setIsClearing(true)
        try {
            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-all-items`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filter: 'hq' })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to clear items')
            }

            alert('HQ Inventory Masterlist cleared successfully')
            fetchItems()
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setIsClearing(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [])

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center bg-surface border border-foreground/10 p-4">
                <h2 className="text-[18px] font-semibold text-foreground uppercase tracking-widest">HQ Inventory Masterlist</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleClearAll}
                        disabled={isClearing || items.length === 0}
                        className="bg-error/10 hover:bg-error/20 text-error px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-error/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isClearing ? 'Clearing...' : 'Clear All'}
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-primary hover:bg-secondary-hover text-background px-6 py-2.5 text-xs font-bold uppercase tracking-widest shadow-card transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Import Masterlist
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-foreground/10 overflow-hidden shadow-card p-4">
                {loading ? (
                    <div className="text-center py-8 text-foreground-muted">Loading items...</div>
                ) : error ? (
                    <div className="text-center py-8 text-error">{error}</div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center bg-secondary/10">
                            <Inbox className="w-7 h-7 text-foreground-muted" />
                        </div>
                        <h3 className="text-[18px] font-semibold text-foreground mb-2 uppercase tracking-widest">No Items Found</h3>
                        <p className="text-sm text-foreground-muted max-w-xs mb-6">
                            There are currently no HQ Inventory items. Import masterlist to get started.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col space-y-6">
                        {(() => {
                            const groupedItems = items.reduce((groups, item) => {
                                const equipName = item.equipments?.name || 'Uncategorized'
                                const key = equipName
                                if (!groups[key]) groups[key] = []
                                groups[key].push(item)
                                return groups
                            }, {} as Record<string, Item[]>)

                            return Object.entries(groupedItems).map(([equipName, groupItems]) => {
                                const firstItem = groupItems[0]
                                const equipCode = firstItem?.equipments?.unique_code || ''
                                const isAmmunition = equipName === 'AMMUNITIONS' || equipCode === 'AM'

                                return (
                                    <div key={equipName} className="border border-foreground/10 overflow-hidden">
                                        <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10 flex justify-between items-center">
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{equipName}</h4>
                                                {equipCode && <p className="text-xs text-foreground-muted">{equipCode}</p>}
                                            </div>
                                            <div className="text-xs font-semibold text-foreground-muted bg-foreground/10 px-2 py-1">
                                                {groupItems.length} ITEMS
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full relative border-collapse">
                                                <thead className="sticky top-0 bg-surface z-10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                                                    <tr className="bg-foreground/5">
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Unique Code</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Classification</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Nomenclature</th>
                                                        {isAmmunition ? (
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Balance on Hand</th>
                                                        ) : (
                                                            <>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Brand</th>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Model</th>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Serial Number</th>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Part Number</th>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Date Manufactured</th>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Date Acquired</th>
                                                            </>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupItems.map((item) => (
                                                        <tr key={item.id} className="border-b border-foreground/5 hover:bg-foreground/2">
                                                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.unique_code || '-'}</td>
                                                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.classification || '-'}</td>
                                                            <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.nomenclature || '-'}</td>
                                                            {isAmmunition ? (
                                                                <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.quantity ?? '-'}</td>
                                                            ) : (
                                                                <>
                                                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.brand || '-'}</td>
                                                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.model || '-'}</td>
                                                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.serial_number || '-'}</td>
                                                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{item.part_number || '-'}</td>
                                                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_manufactured) || '-'}</td>
                                                                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            })
                        })()}
                    </div>
                )}
            </div>

            <ImportItemsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                isHqInventory={true}
                title="Import Masterlist"
                subtitle="Primary inventory source list"
                onImportComplete={() => {
                    setIsImportModalOpen(false)
                    fetchItems()
                }}
            />
        </div>
    )
}
