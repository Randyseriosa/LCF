'use client'

import React, { useState } from 'react'
import { ClipboardList, Upload, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { BowReportsClient } from './BowReportsClient'
import { ImportPageClient } from '@/features/import/components/ImportPageClient'

type Tab = 'status' | 'import'

interface MonthlyReportClientProps {
    basePath: string
    showImport?: boolean
}

export function MonthlyReportClient({ basePath, showImport = false }: MonthlyReportClientProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<Tab>('status')

    const tabs: { id: Tab; label: string; icon: React.ElementType; encoderOnly?: boolean }[] = [
        { id: 'status', label: 'Status of Report', icon: ClipboardList },
        ...(showImport ? [{ id: 'import' as Tab, label: 'Import Report', icon: Upload }] : []),
    ]

    return (
        <div className="space-y-6">
            <PageHeader
                title="Monthly Report"
                description="Manage and View monthly reports."
                onBack={() => router.push(basePath)}
                Icon={FileText}
            />
            {/* Header with Filters */}
            <div className="flex border-b border-foreground/10">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest
                border-b-2 transition-colors
                ${isActive
                                    ? 'border-primary text-primary bg-primary/5'
                                    : 'border-transparent text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                                }
              `}
                        >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'status' && (
                    <BowReportsClient basePath={basePath} />
                )}
                {activeTab === 'import' && showImport && (
                    <ImportPageClient />
                )}
            </div>
        </div>
    )
}
