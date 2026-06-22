'use client'

import React, { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Ship, Calendar, X, Trash2, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { getAccessToken } from '@/lib/auth'
import { useRecentMonthlyAttachmentImports } from '@/hooks/useRecentMonthlyAttachmentImports'
import { Clock, ExternalLink } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

interface FileQueueItem {
    file: File
    bowNumber: string
    month: string
    year: string
    status: 'pending' | 'uploading' | 'success' | 'error'
    error?: string
}

export function ImportMonthlyAttachmentClient() {
    const router = useRouter()
    const [queue, setQueue] = useState<FileQueueItem[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [reportToDelete, setReportToDelete] = useState<{ id: string, filename: string } | null>(null)
    const [isGlobalLoading, setIsGlobalLoading] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { imports: recentImports, loading: loadingHistory, refresh: refreshHistory } = useRecentMonthlyAttachmentImports(5)

    // Helper to wrap actions with a tactical loading screen
    const withLoading = async (message: string, action: () => Promise<void> | void) => {
        setIsGlobalLoading(true)
        setLoadingMessage(message)
        try {
            await action()
        } finally {
            setIsGlobalLoading(false)
            setLoadingMessage('')
        }
    }

    const parseFilename = (filename: string): { bowNumber: string, month: string, year: string } | null => {
        const regex = /^([^-]+)-(\d{6})-attachment\.pdf$/i
        const match = filename.match(regex)
        if (!match) return null

        const bowNumber = match[1]
        const rawDate = match[2]
        return {
            bowNumber: bowNumber.toUpperCase(),
            month: rawDate.substring(0, 2),
            year: rawDate.substring(2)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        await withLoading('Scanning and preparing attachments...', async () => {
            const supabase = createClient()

            const newItems: FileQueueItem[] = await Promise.all(
                files.map(async file => {
                    const parsed = parseFilename(file.name)
                    if (!parsed) {
                        return {
                            file,
                            bowNumber: 'INVALID',
                            month: '',
                            year: '',
                            status: 'error',
                            error: 'Filename must be Bow-MMYYYY-attachment.pdf'
                        } as FileQueueItem
                    }

                    // Check if vessel exists
                    const { data: vessel } = await supabase
                        .from('vessels')
                        .select('id')
                        .eq('bow_number', parsed.bowNumber)
                        .maybeSingle()

                    if (!vessel && parsed.bowNumber !== 'HQ-INVENTORY') {
                        const { data: vesselBySlug } = await supabase
                            .from('vessels')
                            .select('id')
                            .eq('slug', parsed.bowNumber.toLowerCase())
                            .maybeSingle()

                        if (!vesselBySlug) {
                            return {
                                file,
                                bowNumber: parsed.bowNumber,
                                month: parsed.month,
                                year: parsed.year,
                                status: 'error',
                                error: `Vessel "${parsed.bowNumber}" not found.`
                            } as FileQueueItem
                        }
                    }

                    return {
                        file,
                        bowNumber: parsed.bowNumber,
                        month: parsed.month,
                        year: parsed.year,
                        status: 'pending'
                    } as FileQueueItem
                })
            )

            setQueue(prev => [...prev, ...newItems])
            if (fileInputRef.current) fileInputRef.current.value = ''
        })
    }

    const removeItem = (index: number) => {
        setQueue(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        const pendingItems = queue.filter(item => item.status === 'pending')
        if (pendingItems.length === 0) return

        let importSuccessful = false
        await withLoading('Processing batch upload to deep deck...', async () => {
            setIsSubmitting(true)
            const supabase = createClient()

            const token = getAccessToken()
            if (!token) {
                setIsSubmitting(false)
                alert('Session expired. Please log in again.')
                return
            }

            let successfulResults = 0
            for (let i = 0; i < queue.length; i++) {
                const item = queue[i]
                if (item.status !== 'pending') continue

                // Update status to uploading
                setQueue(prev => {
                    const next = [...prev]
                    next[i] = { ...next[i], status: 'uploading' }
                    return next
                })

                try {
                    // Convert file to base64
                    const fileBuffer = await item.file.arrayBuffer()
                    const uint8Array = new Uint8Array(fileBuffer)
                    let binary = ''
                    const chunkSize = 8192
                    for (let j = 0; j < uint8Array.length; j += chunkSize) {
                        binary += String.fromCharCode(...uint8Array.subarray(j, j + chunkSize))
                    }
                    const base64 = btoa(binary)
                    const fileData = `data:application/pdf;base64,${base64}`

                    const { data, error } = await supabase.functions.invoke('import-monthly-report-attachment', {
                        body: {
                            file_data: fileData,
                            filename: item.file.name
                        },
                        headers: {
                            'X-Authorization': `Bearer ${token}`
                        }
                    })

                    if (error || data?.error) {
                        throw new Error(error?.message || data?.error || 'Unknown error')
                    }

                    successfulResults++
                    setQueue(prev => {
                        const next = [...prev]
                        next[i] = { ...next[i], status: 'success' }
                        return next
                    })
                } catch (err: any) {
                    setQueue(prev => {
                        const next = [...prev]
                        next[i] = { ...next[i], status: 'error', error: err.message }
                        return next
                    })
                }
            }

            setIsSubmitting(false)
            importSuccessful = successfulResults > 0
        })

        // Show success modal and refresh only after loading is complete
        if (importSuccessful) {
            setShowSuccessModal(true)
            // Force a slight delay to ensure DB indexing is complete before refresh
            setTimeout(() => {
                refreshHistory()
                // Automatically clear the entire queue to return to empty state
                setQueue([]);
                // Full page reload to ensure absolute synchronization of all data status
                window.location.reload();
            }, 1000)
        }
    }

    const handleDeleteRecent = async (id: string, filename: string) => {
        setReportToDelete({ id, filename })
        setShowConfirmModal(true)
    }

    const confirmDeleteReport = async () => {
        if (!reportToDelete) return
        const { id } = reportToDelete

        setIsSubmitting(true)
        setShowConfirmModal(false)

        try {
            const token = getAccessToken()
            const supabase = createClient()
            const { data, error } = await supabase.functions.invoke('delete-monthly-report-attachment', {
                body: { id },
                headers: { 'X-Authorization': `Bearer ${token}` }
            })

            if (error || data?.error) throw new Error(error?.message || data?.error)

            refreshHistory()
        } catch (err: any) {
            alert(err.message || 'Failed to delete report')
        } finally {
            setIsSubmitting(false)
            setReportToDelete(null)
        }
    }

    const getMonthName = (m: string) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const idx = parseInt(m) - 1
        return months[idx] || m
    }

    return (
        <div className="space-y-6">
            <div className="bg-surface border border-foreground/10 p-8 shadow-card flex flex-col items-center justify-center text-center cursor-pointer hover:bg-foreground/[0.02] transition-all group relative overflow-hidden"
                onClick={() => fileInputRef.current?.click()}>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground mb-2">Drag & Drop PDF Reports</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-6">
                        Filename must follow: <span className="text-primary">Bow-MMYYYY-attachment.pdf</span>
                    </p>
                    <button className="bg-primary text-background px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary/90 transition-colors shadow-card">
                        Select Files
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        accept=".pdf"
                        className="hidden"
                    />
                </div>
            </div>

            {queue.length > 0 && (
                <div className="bg-surface border border-foreground/10 shadow-card">
                    <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Import Queue ({queue.length})</h4>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setQueue([])}
                                className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-red-500 transition-colors"
                            >
                                Clear Queue
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !queue.some(i => i.status === 'pending')}
                                className="bg-accent text-white px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 disabled:opacity-50 transition-all shadow-card"
                            >
                                {isSubmitting ? 'Uploading...' : 'Start Import'}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-foreground/5 border-b border-foreground/10">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Filename</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Detected Bow</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Period</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-foreground-muted uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-foreground/5">
                                {queue.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-foreground/[0.01] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-primary shrink-0" />
                                                <span className="text-xs font-bold text-foreground truncate max-w-[200px]" title={item.file.name}>{item.file.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <Ship className="w-3.5 h-3.5 text-foreground-muted" />
                                                <span className={`text-[11px] font-black uppercase ${item.bowNumber === 'INVALID' ? 'text-red-500 font-black' : 'text-foreground'}`}>
                                                    {item.bowNumber}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.month && (
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-foreground-muted" />
                                                    <span className="text-[11px] font-bold text-foreground">
                                                        {getMonthName(item.month)} {item.year}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.status === 'pending' && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-foreground/5 text-foreground-muted border border-foreground/10">Pending</span>
                                            )}
                                            {item.status === 'uploading' && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 animate-pulse">Uploading...</span>
                                            )}
                                            {item.status === 'success' && (
                                                <div className="flex items-center gap-1.5 text-success">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Imported</span>
                                                </div>
                                            )}
                                            {item.status === 'error' && (
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 text-red-500">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Failed</span>
                                                    </div>
                                                    <span className="text-[8px] text-red-400 font-bold uppercase">{item.error}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => removeItem(idx)}
                                                disabled={item.status === 'uploading'}
                                                className="p-2 text-foreground-muted hover:text-red-500 transition-colors disabled:opacity-30"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="IMPORT COMPLETE"
                message="Monthly report attachments have been processed and added to the deep deck storage."
            />

            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={confirmDeleteReport}
                title="PURGE ATTACHMENT"
                message={`ARE YOU CERTAIN YOU WANT TO DELETE "${reportToDelete?.filename}"? THIS ACTION IS IRREVERSIBLE.`}
                confirmText="PURGE"
                cancelText="ABORT"
            />

            {/* ── Recent History Section ── */}
            <div className="mt-8 pt-8 border-t border-foreground/10">
                <div className="flex items-center gap-2 mb-6">
                    <Clock className="w-5 h-5 text-primary" />
                    <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-foreground">Recent Attachment Imports</h3>
                </div>

                {loadingHistory ? (
                    <div className="bg-surface border border-foreground/10 p-8 text-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted animate-pulse">Loading history...</span>
                    </div>
                ) : recentImports.length === 0 ? (
                    <div className="bg-surface border border-foreground/10 p-8 text-center text-foreground-muted italic text-[10px] uppercase tracking-widest">
                        No recent imports found.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recentImports.map((imp) => (
                            <div key={imp.id} className="bg-surface border border-foreground/10 p-4 shadow-card hover:border-primary/30 transition-all group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-8 h-8 bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <FileText className="w-4 h-4 text-primary" />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">
                                        {new Date(imp.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-foreground uppercase tracking-tight truncate mb-1" title={imp.filename}>
                                    {imp.filename}
                                </h4>
                                <div className="flex flex-col gap-1 mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <Ship className="w-3 h-3 text-primary" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{imp.bow_number}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3 text-primary" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                                            {imp.report_month}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4">
                                    <a
                                        href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/monthly-report-attachments/${imp.file_path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-foreground/5 hover:bg-primary/10 text-foreground-muted hover:text-primary border border-foreground/10 hover:border-primary/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Open
                                    </a>
                                    <button
                                        onClick={() => handleDeleteRecent(imp.id, imp.filename)}
                                        disabled={isSubmitting}
                                        className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 disabled:opacity-50 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <LoadingOverlay isOpen={isGlobalLoading} message={loadingMessage} />
        </div>
    )
}
