'use client'

import React, { useState } from 'react'
import { Inbox } from 'lucide-react'
import { BowInventoryTransfer } from '@/features/hlcf/components/BowInventoryTransfer'
import { HistoryLogs } from '@/features/hlcf/components/HistoryLogs'
import { ImportItemsModal } from '@/features/equipment/components/ImportItemsModal'

export function HLCFPageClient() {
    const [activeTab, setActiveTab] = useState<'hq' | 'bow' | 'logs'>('hq')
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-[20px] font-semibold text-foreground uppercase tracking-widest">HLCF INVENTORY</h1>
            </div>

            {/* Segmented Control */}
            <div className="flex bg-surface border border-foreground/10 w-fit">
                <button
                    onClick={() => setActiveTab('hq')}
                    className={`px-8 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors ${activeTab === 'hq'
                        ? 'bg-primary text-background'
                        : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                        }`}
                >
                    HQ Inventory
                </button>
                <button
                    onClick={() => setActiveTab('bow')}
                    className={`px-8 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors border-l border-foreground/10 ${activeTab === 'bow'
                        ? 'bg-primary text-background'
                        : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                        }`}
                >
                    Bow Inventory
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-8 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors border-l border-foreground/10 ${activeTab === 'logs'
                        ? 'bg-primary text-background'
                        : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                        }`}
                >
                    History Logs
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-surface border border-foreground/5 shadow-card p-6">
                {activeTab === 'hq' && (
                    <div className="flex flex-col">
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="bg-primary hover:bg-secondary-hover text-background px-6 py-2.5 text-xs font-bold uppercase tracking-widest shadow-card transition-colors"
                            >
                                Import Items
                            </button>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center py-12">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center bg-secondary/10">
                                <Inbox className="w-7 h-7 text-foreground-muted" />
                            </div>
                            <h3 className="text-foreground font-semibold text-[18px] mb-2 uppercase tracking-widest">HQ Inventory</h3>
                            <p className="text-foreground-muted text-sm max-w-xs mb-6">
                                HQ Inventory content is not yet available.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'bow' && (
                    <div className="py-2">
                        <BowInventoryTransfer />
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="py-2">
                        <HistoryLogs />
                    </div>
                )}
            </div>

            <ImportItemsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportComplete={() => {
                    setIsImportModalOpen(false)
                    // If we had a table here we would refresh it
                }}
            />
        </div>
    )
}
