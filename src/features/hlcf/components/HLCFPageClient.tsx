'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { HistoryLogs } from '@/features/hlcf/components/HistoryLogs'
import { MasterListTab } from '@/features/hlcf/components/MasterListTab'
import { ReportsTab } from '@/features/hlcf/components/ReportsTab'
import { HQInventoryTab } from '@/features/hlcf/components/HQInventoryTab'
import { ImportItemsModal } from '@/features/equipment/components/ImportItemsModal'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { Package } from 'lucide-react'

type HLCFTab = 'hq' | 'masterlist' | 'reports'
const VALID_TABS: HLCFTab[] = ['hq', 'masterlist', 'reports']

export function HLCFPageClient({ basePath }: { basePath: string }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Read initial state from URL, fall back to defaults
    const now = new Date()
    const rawTab = searchParams.get('tab') as HLCFTab | null
    const initialTab: HLCFTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'hq'
    const initialMonth = parseInt(searchParams.get('month') ?? String(now.getMonth()), 10)
    const initialYear = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)

    const [activeTab, setActiveTabState] = useState<HLCFTab>(initialTab)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [hqRefreshKey, setHqRefreshKey] = useState(0)
    const [reportExists, setReportExists] = useState(false)
    const [isClearingReport, setIsClearingReport] = useState(false)
    const [selectedYear, setSelectedYearState] = useState(
        isNaN(initialYear) ? now.getFullYear() : initialYear
    )
    const [selectedMonth, setSelectedMonthState] = useState(
        isNaN(initialMonth) ? now.getMonth() : initialMonth
    )

    // Check if report exists for selected month/year
    useEffect(() => {
        const checkReport = async () => {
            const supabase = createClient()
            const reportMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

            const { data: hqVessel } = await supabase
                .from('vessels')
                .select('id')
                .eq('slug', 'hq-inventory')
                .single()

            if (!hqVessel) return

            const { data } = await supabase
                .from('monthly_reports')
                .select('id')
                .eq('vessel_id', hqVessel.id)
                .eq('report_month', reportMonth)
                .maybeSingle()

            setReportExists(!!data)
        }

        if (activeTab === 'hq') {
            checkReport()
        }
    }, [selectedMonth, selectedYear, activeTab, hqRefreshKey])

    const handleClearReport = async () => {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        const confirmMsg = `ARE YOU SURE YOU WANT TO CLEAR THE HQ INVENTORY REPORT FOR ${monthNames[selectedMonth].toUpperCase()} ${selectedYear}? THIS WILL DELETE ALL REPORT ITEMS FOR THIS PERIOD.`

        if (!window.confirm(confirmMsg)) return

        setIsClearingReport(true)
        try {
            const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
            const token = match ? decodeURIComponent(match[1]) : null
            if (!token) throw new Error('Not authenticated')

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-monthly-report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vesselSlug: 'hq-inventory',
                    month: selectedMonth,
                    year: selectedYear
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to clear report')
            }

            setHqRefreshKey(k => k + 1)
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setIsClearingReport(false)
        }
    }

    /** Update URL params without causing a full navigation */
    const updateUrl = useCallback(
        (tab: HLCFTab, month: number, year: number) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', tab)
            params.set('month', String(month))
            params.set('year', String(year))
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        },
        [router, pathname, searchParams]
    )

    const setActiveTab = useCallback(
        (tab: HLCFTab) => {
            setActiveTabState(tab)
            updateUrl(tab, selectedMonth, selectedYear)
        },
        [updateUrl, selectedMonth, selectedYear]
    )

    const setSelectedMonth = useCallback(
        (month: number) => {
            setSelectedMonthState(month)
            updateUrl(activeTab, month, selectedYear)
        },
        [updateUrl, activeTab, selectedYear]
    )

    const setSelectedYear = useCallback(
        (year: number) => {
            setSelectedYearState(year)
            updateUrl(activeTab, selectedMonth, year)
        },
        [updateUrl, activeTab, selectedMonth]
    )



    return (
        <div className="flex flex-col">
            <PageHeader
                title="OLCF6 Inventory"
                description="Manage OLCF6 Inventory, Vessels, and Equipment"
                onBack={() => router.push(basePath)}
                Icon={Package}
                bannerImage="/images/banners/banner-general.webp"
            />

            <div className="space-y-6">
                {/* Segmented Control */}
                <div className="flex bg-surface border border-foreground/10 w-fit">
                    <button
                        onClick={() => setActiveTab('hq')}
                        className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${activeTab === 'hq'
                            ? 'bg-primary text-background'
                            : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                            }`}
                    >
                        Monthly Inventory View
                    </button>
                    <button
                        onClick={() => setActiveTab('masterlist')}
                        className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors border-l border-foreground/10 ${activeTab === 'masterlist'
                            ? 'bg-primary text-background'
                            : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                            }`}
                    >
                        Masterlist
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-6 py-2 text-xs font-semibold uppercase tracking-widest transition-colors border-l border-foreground/10 ${activeTab === 'reports'
                            ? 'bg-primary text-background'
                            : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                            }`}
                    >
                        Summary of Reports
                    </button>
                </div>


                {/* Content Area */}
                <div className="bg-surface border border-foreground/5 shadow-card p-6">
                    {activeTab === 'hq' && (
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-4">
                                    {/* Unified Month/Year Picker */}
                                    <MonthYearPicker
                                        month={selectedMonth}
                                        year={selectedYear}
                                        onChange={(m, y) => {
                                            setSelectedMonthState(m)
                                            setSelectedYearState(y)
                                            updateUrl(activeTab, m, y)
                                        }}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    {reportExists && (
                                        <button
                                            onClick={handleClearReport}
                                            disabled={isClearingReport}
                                            className="bg-error/5 hover:bg-error/10 text-error px-4 py-2.5 text-xs font-bold uppercase tracking-widest border border-error/10 transition-colors disabled:opacity-50"
                                        >
                                            {isClearingReport ? 'Clearing...' : 'Clear Report'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsImportModalOpen(true)}
                                        className="bg-primary hover:bg-secondary-hover text-background px-6 py-2.5 text-xs font-bold uppercase tracking-widest shadow-card transition-colors"
                                    >
                                        {reportExists ? 'Update Monthly Report' : 'Import Monthly Report'}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4">
                                <HQInventoryTab
                                    key={hqRefreshKey}
                                    month={selectedMonth}
                                    year={selectedYear}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'masterlist' && (
                        <div className="py-2">
                            <MasterListTab />
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="py-2">
                            <ReportsTab />
                        </div>
                    )}
                </div>

                <ImportItemsModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    isHqInventory={true}
                    isMonthlyReport={true}
                    month={selectedMonth}
                    year={selectedYear}
                    title="Import Monthly Report"
                    subtitle="Monthly inventory status update"
                    onImportComplete={() => {
                        setIsImportModalOpen(false)
                        setActiveTabState('hq')
                        updateUrl('hq', selectedMonth, selectedYear)
                        setHqRefreshKey(k => k + 1)
                    }}
                />
            </div>
        </div>
    )
}
