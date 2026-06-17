'use client'

import React, { useState } from 'react'
import { ClipboardList, Upload, FileText, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { BowReportsClient } from './BowReportsClient'
import { ImportPageClient } from '@/features/import/components/ImportPageClient'
import { DerangementImportClient } from '@/features/import/components/DerangementImportClient'
import { DerangementItemsClient } from './DerangementItemsClient'

type MainTab = 'monthly' | 'derangement'
type SubTab = 'status' | 'import' | 'derangement'

interface MonthlyReportClientProps {
    basePath: string
    showImport?: boolean
}

export function MonthlyReportClient({ basePath, showImport = false }: MonthlyReportClientProps) {
    const router = useRouter()
    const [mainTab, setMainTab] = useState<MainTab>('monthly')
    const [activeMonthlyTab, setActiveMonthlyTab] = useState<SubTab>('status')
    const [activeDerangementTab, setActiveDerangementTab] = useState<SubTab>('derangement')

    // Monthly Sub-tabs
    const monthlyTabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
        { id: 'status', label: 'Status of Report', icon: ClipboardList },
        ...(showImport ? [{ id: 'import' as SubTab, label: 'Import Report', icon: Upload }] : []),
    ]

    // Derangement Sub-tabs
    const derangementTabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
        { id: 'derangement', label: 'Items with Derangement', icon: AlertTriangle },
        ...(showImport ? [{ id: 'import' as SubTab, label: 'Import Report', icon: Upload }] : []),
    ]

    const activeSubTab = mainTab === 'monthly' ? activeMonthlyTab : activeDerangementTab
    const currentTabs = mainTab === 'monthly' ? monthlyTabs : derangementTabs

    return (
        <div className="space-y-6">
            <PageHeader
                title={mainTab === 'monthly' ? "Monthly Report" : "Equipment Derangement Reports"}
                description={mainTab === 'monthly' ? "Manage and View monthly reports." : "Track and manage equipment derangements."}
                onBack={() => router.push(basePath)}
                Icon={mainTab === 'monthly' ? FileText : AlertTriangle}
                actions={
                    <div className="flex bg-surface border border-foreground/10 w-fit">
                        <button
                            onClick={() => setMainTab('monthly')}
                            className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${mainTab === 'monthly'
                                ? 'bg-primary text-background'
                                : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                                }`}
                        >
                            Monthly Report
                        </button>
                        <button
                            onClick={() => setMainTab('derangement')}
                            className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition-colors border-l border-foreground/10 ${mainTab === 'derangement'
                                ? 'bg-primary text-background'
                                : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                                }`}
                        >
                            Equipment Derangement Reports
                        </button>
                    </div>
                }
            />

            {/* Sub Tabs Indicator Bar */}
            <div className="flex border-b border-foreground/10">
                {currentTabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeSubTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => mainTab === 'monthly' ? setActiveMonthlyTab(tab.id) : setActiveDerangementTab(tab.id)}
                            className={`
                flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest
                border-b-2 transition-all duration-200
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

            {/* Content Area */}
            <div>
                {mainTab === 'monthly' && (
                    <>
                        {activeMonthlyTab === 'status' && (
                            <BowReportsClient basePath={basePath} />
                        )}
                        {activeMonthlyTab === 'import' && showImport && (
                            <ImportPageClient mode="monthly" />
                        )}
                    </>
                )}
                {mainTab === 'derangement' && (
                    <>
                        {activeDerangementTab === 'derangement' && (
                            <DerangementItemsClient />
                        )}
                        {activeDerangementTab === 'import' && showImport && (
                            <DerangementImportClient />
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
