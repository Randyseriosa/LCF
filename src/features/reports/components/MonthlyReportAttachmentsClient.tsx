'use client'

import React, { useState } from 'react'
import { FileText, ExternalLink, Search, X, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { useVesselsWithReportStatus } from '@/hooks/useVesselsWithReportStatus'
import { useMonthlyReportAttachments } from '@/hooks/useMonthlyReportAttachments'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { getAccessToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

export function MonthlyReportAttachmentsClient() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [vesselFilter, setVesselFilter] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [showClearAllModal, setShowClearAllModal] = useState(false)
    const [attachmentToDelete, setAttachmentToDelete] = useState<{ id: string, filename: string } | null>(null)

    const { vessels, loading: loadingVessels, error: errorVessels } = useVesselsWithReportStatus({
        month: selectedMonth,
        year: selectedYear,
        bowNumberFilter: vesselFilter || null
    })

    const { attachments, loading: loadingAttachments, error: errorAttachments, refresh: refreshAttachments } = useMonthlyReportAttachments({
        month: selectedMonth,
        year: selectedYear
    })

    const loading = loadingVessels || loadingAttachments
    const error = errorVessels || errorAttachments

    // Match attachments to vessels
    const attachmentMap = new Map(attachments.map(att => [att.vessel_id, att]))

    const handleDeleteClick = (id: string, filename: string) => {
        setAttachmentToDelete({ id, filename })
        setShowConfirmModal(true)
    }

    const confirmDelete = async () => {
        if (!attachmentToDelete) return
        setIsDeleting(true)
        setShowConfirmModal(false)

        try {
            const token = getAccessToken()

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-monthly-report-attachment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: attachmentToDelete.id })
            })

            const data = await response.json()

            if (!response.ok || data?.error) throw new Error(data?.error || 'Failed to delete attachment')

            refreshAttachments()
        } catch (err: any) {
            alert(err.message || 'Failed to delete attachment')
        } finally {
            setIsDeleting(false)
            setAttachmentToDelete(null)
        }
    }

    const handleClearAll = async () => {
        setIsDeleting(true)
        setShowClearAllModal(false)

        try {
            const token = getAccessToken()
            const reportMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-all-attachments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ report_month: reportMonth })
            })

            const data = await response.json()

            if (!response.ok || data?.error) throw new Error(data?.error || 'Failed to clear attachments')

            refreshAttachments()
        } catch (err: any) {
            alert(err.message || 'Failed to clear attachments')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-surface shadow-card border border-foreground/10 overflow-hidden">
                <div className="p-3">
                    <div className="flex flex-col lg:flex-row items-end gap-3">
                        <div className="shrink-0 w-full lg:w-auto">
                            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1.5 block">Report Period</label>
                            <MonthYearPicker
                                month={selectedMonth}
                                year={selectedYear}
                                onChange={(m, y) => {
                                    setSelectedMonth(m)
                                    setSelectedYear(y)
                                }}
                            />
                        </div>

                        <div className="w-full lg:flex-1 shrink-0">
                            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1.5 block">Search Bow</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                                <input
                                    type="text"
                                    placeholder="Search by bow number..."
                                    value={vesselFilter}
                                    onChange={(e) => setVesselFilter(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-foreground/10 bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm h-11"
                                />
                                {vesselFilter && (
                                    <button onClick={() => setVesselFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <X className="w-4 h-4 text-foreground-muted hover:text-foreground" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-foreground/10">
                    {loading ? (
                        <div className="px-5 py-8 text-center text-foreground-muted text-sm uppercase tracking-widest font-bold">
                            Loading data...
                        </div>
                    ) : error ? (
                        <div className="px-5 py-4 text-error text-sm font-bold uppercase tracking-widest">
                            {error}
                        </div>
                    ) : vessels.length === 0 ? (
                        <div className="px-5 py-12 text-center text-foreground-muted text-[10px] font-bold uppercase tracking-[0.2em]">
                            No vessels found matching your filter
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-fixed">
                                <thead className="bg-foreground/5 border-b border-foreground/10">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap">Vessel (Bow)</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap">Class</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] whitespace-nowrap w-40">Reports</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vessels.map((vessel) => {
                                        const attachment = attachmentMap.get(vessel.id)
                                        const isSubmitted = vessel.submitted

                                        return (
                                            <tr key={vessel.id} className="hover:bg-foreground/[0.01] transition-colors border-b border-foreground/5">
                                                <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                    {!isSubmitted ? (
                                                        <div className="text-foreground-muted font-bold uppercase tracking-widest flex items-center gap-2 cursor-not-allowed opacity-30">
                                                            {vessel.bow_number}
                                                        </div>
                                                    ) : (
                                                        <div className="text-primary font-bold uppercase tracking-widest flex items-center gap-2">
                                                            {vessel.bow_number}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${!isSubmitted ? 'text-foreground-muted opacity-30' : 'text-foreground-muted'}`}>
                                                        {vessel.class_of_vessel?.name || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs whitespace-nowrap text-right w-40">
                                                    <div className="flex items-center justify-end">
                                                        {!isSubmitted ? (
                                                            <div className="flex items-center gap-2 px-2.5 py-1 bg-foreground/5 border border-foreground/10 text-foreground-muted rounded-none">
                                                                <XCircle className="w-3 h-3" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">Pending</span>
                                                            </div>
                                                        ) : attachment ? (
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/monthly-report-attachments/${attachment.file_path}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-background text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-card"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                    View
                                                                </a>
                                                                <button
                                                                    onClick={() => handleDeleteClick(attachment.id, attachment.filename)}
                                                                    disabled={isDeleting}
                                                                    className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 disabled:opacity-50 transition-all shadow-card"
                                                                    title="Purge Attachment"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 px-2.5 py-1 bg-foreground/5 border border-foreground/10 text-foreground-muted rounded-none italic">
                                                                <span className="text-[9px] font-black uppercase tracking-widest">No Attachment</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmDelete}
                title="PURGE ATTACHMENT"
                message={`ARE YOU CERTAIN YOU WANT TO DELETE THE ATTACHMENT "${attachmentToDelete?.filename}"? THIS ACTION IS IRREVERSIBLE.`}
                confirmText="PURGE"
                cancelText="ABORT"
            />

            <ConfirmModal
                isOpen={showClearAllModal}
                onClose={() => setShowClearAllModal(false)}
                onConfirm={handleClearAll}
                title="PURGE ALL ATTACHMENTS"
                message={`CRITICAL: YOU ARE ABOUT TO PURGE ALL PDF ATTACHMENTS FOR THE ENTIRE FLEET IN ${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}. THIS ACTION CANNOT BE UNDONE.`}
                confirmText="PURGE ALL"
                cancelText="ABORT"
            />

            {/* Floating Operations Button (FAB) */}
            <div className="fixed bottom-10 right-10 z-[9999] flex flex-col items-end">
                {attachments.length > 0 && (
                    <div className="group relative flex items-center">
                        <span className="absolute right-full mr-4 px-3 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-white/10">
                            PURGE ALL ATTACHMENTS ({attachments.length})
                        </span>
                        <button
                            onClick={() => setShowClearAllModal(true)}
                            disabled={isDeleting}
                            className={`w-14 h-14 rounded-full bg-red-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:bg-red-700 transition-all flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:grayscale`}
                            title="Purge all attachments for this period"
                        >
                            <Trash2 className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
