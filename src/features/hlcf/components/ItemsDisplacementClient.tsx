'use client'

import React, { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArrowLeftRight } from 'lucide-react'
import { BowInventoryTransfer } from '@/features/hlcf/components/BowInventoryTransfer'
import { HistoryLogs } from '@/features/hlcf/components/HistoryLogs'

export function ItemsDisplacementClient() {
    const [activeTab, setActiveTab] = useState<'displacement' | 'history'>('displacement')

    return (
        <div className="space-y-6">
            <PageHeader
                title="Items Displacement"
                description="Transfer items between vessels"
                Icon={ArrowLeftRight}
            />

            {/* Segmented Control */}
            <div className="flex bg-surface border border-foreground/10 w-fit">
                <button
                    onClick={() => setActiveTab('displacement')}
                    className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${activeTab === 'displacement'
                        ? 'bg-primary text-background'
                        : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                        }`}
                >
                    Items Displacement
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors border-l border-foreground/10 ${activeTab === 'history'
                        ? 'bg-primary text-background'
                        : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                        }`}
                >
                    History of Transfer
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'displacement' ? (
                <div className="bg-surface border border-foreground/5 shadow-card p-6">
                    <BowInventoryTransfer />
                </div>
            ) : (
                <HistoryLogs />
            )}
        </div>
    )
}
