'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { formatDateToDDMMYYYY } from '@/utils/dateUtils'

interface LogEntry {
    id: string
    item_id: string
    old_vessel_id: string
    new_vessel_id: string
    old_unique_code: string
    new_unique_code: string
    action: string
    created_at: string

    item?: { nomenclature: string }
    old_vessel?: { bow_number: string }
    new_vessel?: { bow_number: string }
}

export function HistoryLogs() {
    const supabase = createClient()
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('item_transfer_logs')
                .select(`
          id, old_vessel_id, new_vessel_id, old_unique_code, new_unique_code, action, created_at,
          item:items(nomenclature),
          old_vessel:vessels!old_vessel_id(bow_number),
          new_vessel:vessels!new_vessel_id(bow_number)
        `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (data) {
                setLogs(data as any[])
            }
            setLoading(false)
        }

        fetchLogs()
    }, [supabase])

    return (
        <div className="bg-surface border border-foreground/5 shadow-card p-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-foreground font-semibold text-[16px] uppercase tracking-widest">Recent Transfers</h3>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-12 text-sm text-foreground-muted uppercase tracking-widest">
                    No transfer logs available
                </div>
            ) : (
                <div className="overflow-x-auto border border-foreground/10">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-background text-foreground uppercase tracking-widest text-xs border-b border-foreground/10">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Item Name</th>
                                <th className="px-4 py-3">From Bow</th>
                                <th className="px-4 py-3">To Bow</th>
                                <th className="px-4 py-3">Old Code</th>
                                <th className="px-4 py-3 text-primary">New Code</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} className="border-b border-foreground/5 hover:bg-secondary/5 transition-colors">
                                    <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
                                        {formatDateToDDMMYYYY(log.created_at)}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-semibold text-foreground truncate max-w-[200px]">
                                        {log.item?.nomenclature || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-foreground-muted">
                                        {log.old_vessel?.bow_number || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-foreground font-medium">
                                        {log.new_vessel?.bow_number || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-foreground-muted font-mono">
                                        {log.old_unique_code || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-primary font-mono font-bold">
                                        {log.new_unique_code || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
