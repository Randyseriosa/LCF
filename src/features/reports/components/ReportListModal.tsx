'use client'

import React from 'react'
import { X, FileText, ExternalLink, Ship, Calendar, Trash2, AlertCircle } from 'lucide-react'
import { useItemDerangementReports } from '@/hooks/useDerangementItems'
import { createClient } from '@/lib/supabase/client'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SuccessModal } from '@/components/ui/SuccessModal'

interface ReportListModalProps {
    isOpen: boolean
    onClose: () => void
    itemId: string | null
    vesselId: string | null
    vesselBow: string | null
    itemCode: string | null
    itemNomenclature: string | null
    onRefresh: () => void
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

function formatReportMonth(reportMonth: string | null): string {
    if (!reportMonth) return '-'
    try {
        const [y, m] = reportMonth.split('-')
        return `${MONTHS[parseInt(m) - 1]} ${y}`
    } catch {
        return reportMonth ?? '-'
    }
}

export function ReportListModal({
    isOpen,
    onClose,
    itemId,
    vesselId,
    vesselBow,
    itemCode,
    itemNomenclature,
    onRefresh
}: ReportListModalProps) {
    const { reports, loading, error, refresh } = useItemDerangementReports(itemId, vesselId)
    const [isDeleting, setIsDeleting] = React.useState<string | null>(null)
    const [deleteError, setDeleteError] = React.useState<string | null>(null)
    const [showConfirmModal, setShowConfirmModal] = React.useState(false)
    const [reportToDelete, setReportToDelete] = React.useState<{ id: string, filename: string } | null>(null)
    const [showSuccessModal, setShowSuccessModal] = React.useState(false)
    const [successMessage, setSuccessMessage] = React.useState('')

    const handleDelete = (reportId: string, filename: string) => {
        setReportToDelete({ id: reportId, filename })
        setShowConfirmModal(true)
    }

    const confirmDelete = async () => {
        if (!reportToDelete) return
        const { id: reportId, filename } = reportToDelete

        setIsDeleting(reportId)
        setDeleteError(null)
        setShowConfirmModal(false)

        try {
            const supabase = createClient()
            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const { data, error: functionError } = await supabase.functions.invoke('delete-derangement-report', {
                body: { id: reportId },
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (functionError) throw functionError
            if (data?.error) throw new Error(data.error)

            // Success message
            setSuccessMessage(`REPORT: "${filename}" DELETED SUCCESSFULLY.`)
            setShowSuccessModal(true)

            // Refresh the lists
            refresh()
            onRefresh()
        } catch (err: any) {
            console.error('Delete error:', err)
            setDeleteError(err.message || 'Failed to delete report')
        } finally {
            setIsDeleting(null)
            setReportToDelete(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface border-2 border-primary/40 shadow-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-primary px-6 py-4 flex items-center justify-between border-b border-primary/20">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black text-background uppercase tracking-widest leading-none">
                            Derangement Reports
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-background/70">
                            <div className="flex items-center gap-1">
                                <Ship className="w-3 h-3" />
                                <span>{vesselBow}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                                <span className="text-background">{itemCode}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-background hover:bg-background/20 transition-colors p-2"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-background">
                    {loading ? (
                        <div className="py-20 text-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted animate-pulse">Loading reports...</span>
                        </div>
                    ) : error ? (
                        <div className="py-20 text-center text-red-500 bg-red-500/5 border border-red-500/20 px-6">
                            <span className="text-xs font-bold uppercase tracking-widest leading-relaxed">{error}</span>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-foreground/5 mx-auto flex items-center justify-center mb-4">
                                <FileText className="w-8 h-8 text-foreground-muted" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest text-foreground-muted">No reports found for this item.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {reports.map((report) => (
                                <div key={report.id} className="group border border-foreground/10 bg-surface p-4 flex items-center justify-between hover:border-primary/30 transition-all shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                                            <FileText className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-foreground uppercase tracking-tight truncate max-w-[280px]">
                                                {report.filename}
                                            </span>
                                            <div className="flex items-center gap-3 mt-1">
                                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                                                    <Calendar className="w-3 h-3 text-primary" />
                                                    <span>{new Date(report.created_at).toLocaleDateString('en-US')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/derangement-reports/${report.file_path}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-sm"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            View PDF
                                        </a>
                                        <button
                                            onClick={() => handleDelete(report.id, report.filename)}
                                            disabled={isDeleting === report.id}
                                            className="flex h-[34px] w-[34px] items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50 transition-colors shadow-sm border border-red-500/20"
                                            title="Delete Report"
                                        >
                                            {isDeleting === report.id ? (
                                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent animate-spin rounded-full" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {deleteError && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{deleteError}</span>
                        </div>
                    )
                    }
                </div>

                {/* Footer */}
                <div className="bg-foreground/5 p-4 border-t border-foreground/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest border border-foreground/20 hover:bg-foreground/5 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => {
                    setShowConfirmModal(false)
                    setReportToDelete(null)
                }}
                onConfirm={confirmDelete}
                title="Confirm report DELETION"
                message={`ARE YOU CERTAIN YOU WANT TO PERMANENTLY REMOVE "${reportToDelete?.filename}"? THIS ACTION CANNOT BE REVERSED.`}
                confirmText="PURGE REPORT"
                cancelText="ABORT"
                confirmButtonClassName="px-6 py-2.5 text-[10px] font-black bg-primary text-background hover:bg-primary/90 transition-colors uppercase tracking-widest"
            />

            {/* Success Modal */}
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Operation Successful"
                message={successMessage}
            />
        </div>
    )
}
