'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Inbox, FileSpreadsheet } from 'lucide-react'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'

interface ReportItem {
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
    balance_on_hand: number | null
    date_last_pms?: string
    date_last_repair?: string
    running_hours?: number | null
    status: string
    remarks: string
    equipment_name?: string
    equipment_code?: string
}

interface HQInventoryTabProps {
    month: number
    year: number
    onRefresh?: () => void
}

export function HQInventoryTab({ month, year }: HQInventoryTabProps) {
    const [items, setItems] = useState<ReportItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchReportItems = async () => {
        setLoading(true)
        setError(null)
        try {
            const supabase = createClient()
            const reportMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`

            // 1. Find HQ Vessel
            const { data: hqVessel } = await supabase
                .from('vessels')
                .select('id')
                .eq('slug', 'hq-inventory')
                .single()

            if (!hqVessel) {
                setItems([])
                return
            }

            // 2. Find Monthly Report for this month/year
            const { data: report } = await supabase
                .from('monthly_reports')
                .select('id')
                .eq('vessel_id', hqVessel.id)
                .eq('report_month', reportMonth)
                .maybeSingle()

            if (!report) {
                setItems([])
                return
            }

            // 3. Fetch Items for this report
            const { data: reportItems, error: fetchError } = await supabase
                .from('monthly_report_items')
                .select(`
                    id, 
                    unique_code, 
                    classification, 
                    nomenclature, 
                    brand, 
                    model, 
                    serial_number, 
                    part_number, 
                    date_manufactured, 
                    date_installed_issued, 
                    balance_on_hand,
                    date_last_pms,
                    date_last_repair,
                    running_hours,
                    status, 
                    remarks,
                    items (
                        equipments (
                            name,
                            unique_code
                        )
                    )
                `)
                .eq('report_id', report.id)
                .order('unique_code', { ascending: true })

            if (fetchError) throw fetchError

            const mappedItems: ReportItem[] = (reportItems || []).map((ri: any) => ({
                id: ri.id,
                unique_code: ri.unique_code,
                classification: ri.classification,
                nomenclature: ri.nomenclature,
                brand: ri.brand,
                model: ri.model,
                serial_number: ri.serial_number,
                part_number: ri.part_number,
                date_manufactured: ri.date_manufactured,
                date_installed_issued: ri.date_installed_issued,
                balance_on_hand: ri.balance_on_hand,
                date_last_pms: ri.date_last_pms,
                date_last_repair: ri.date_last_repair,
                running_hours: ri.running_hours,
                status: ri.status,
                remarks: ri.remarks,
                equipment_name: ri.items?.equipments?.name || 'Uncategorized',
                equipment_code: ri.items?.equipments?.unique_code
            }))

            setItems(mappedItems)
        } catch (err: any) {
            console.error('Error fetching HQ inventory report:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReportItems()
    }, [month, year])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-foreground-muted text-sm uppercase tracking-widest font-semibold">Loading HQ Inventory...</p>
            </div>
        )
    }

    if (items.length === 0) {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        return (
            <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="mb-4 flex h-14 w-14 items-center justify-center bg-secondary/10">
                    <Inbox className="w-7 h-7 text-foreground-muted" />
                </div>
                <h3 className="text-foreground font-semibold text-[18px] mb-2 uppercase tracking-widest">HQ Inventory</h3>
                <p className="text-foreground-muted text-sm max-w-xs mb-6">
                    HQ Inventory content for {monthNames[month]} {year} is not yet available.
                </p>
            </div>
        )
    }

    // Group items by equipment
    const groupedItems = items.reduce((groups, item) => {
        const key = item.equipment_name || 'Uncategorized'
        if (!groups[key]) groups[key] = []
        groups[key].push(item)
        return groups
    }, {} as Record<string, ReportItem[]>)

    return (
        <div className="flex flex-col space-y-6">
            {Object.entries(groupedItems).map(([equipName, groupItems]) => {
                const equipCode = groupItems[0]?.equipment_code
                const isAmmunition = equipName === 'AMMUNITIONS' || equipCode === 'AM'

                return (
                    <div key={equipName} className="border border-foreground/10 overflow-hidden shadow-sm">
                        <div className="bg-foreground/5 px-4 py-3 border-b border-foreground/10 flex justify-between items-center">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{equipName}</h4>
                                {equipCode && <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-wider">{equipCode}</p>}
                            </div>
                            <div className="text-[10px] font-bold text-foreground-muted bg-foreground/10 px-2 py-1 uppercase tracking-widest">
                                {groupItems.length} ITEMS
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-foreground/2 border-b border-foreground/10">
                                        <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Unique Code</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Nomenclature</th>
                                        {isAmmunition ? (
                                            <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Balance on Hand</th>
                                        ) : (
                                            <>
                                                <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Brand/Model</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Serial No.</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Acquired</th>
                                            </>
                                        )}
                                        <th className="px-4 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-foreground/5">
                                    {groupItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-foreground/2 transition-colors">
                                            <td className="px-4 py-3 text-xs font-medium text-foreground">{item.unique_code}</td>
                                            <td className="px-4 py-3 text-xs text-foreground uppercase">{item.nomenclature}</td>
                                            {isAmmunition ? (
                                                <td className="px-4 py-3 text-xs text-foreground font-mono">{item.balance_on_hand ?? '-'}</td>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 text-xs text-foreground uppercase truncate max-w-[150px]">
                                                        {item.brand} {item.model}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-foreground-muted font-mono">{item.serial_number || '-'}</td>
                                                    <td className="px-4 py-3 text-xs text-foreground-muted italic">{formatDateToDDMMYYYY(item.date_installed_issued) || '-'}</td>
                                                </>
                                            )}
                                            <td className="px-4 py-3 text-[11px] text-foreground-muted italic max-w-[200px] truncate">{item.remarks || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
