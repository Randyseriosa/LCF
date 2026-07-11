'use client'

import React, { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArrowLeftRight } from 'lucide-react'
import { BowInventoryTransfer } from '@/features/hlcf/components/BowInventoryTransfer'
import { HistoryLogs } from '@/features/hlcf/components/HistoryLogs'
import { ROLES, type Role } from '@/lib/types/roles'

export function TransferItemsClient({ role }: { role?: Role }) {
    const isViewer = role === ROLES.viewer
    const [activeTab, setActiveTab] = useState<'displacement' | 'history'>(isViewer ? 'history' : 'displacement')

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transfer Items"
                description={isViewer ? "View history of item transfers" : "Transfer items between vessels"}
                Icon={ArrowLeftRight}
                bannerImage="/images/banners/banner-general.webp"
            />

            {/* Segmented Control */}
            <div className="flex bg-surface border border-foreground/10 w-fit">
                {!isViewer && (
                    <button
                        onClick={() => setActiveTab('displacement')}
                        className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${activeTab === 'displacement'
                            ? 'bg-primary text-background'
                            : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                            }`}
                    >
                        Transfer Items
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${!isViewer ? 'border-l border-foreground/10' : ''} ${activeTab === 'history'
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
