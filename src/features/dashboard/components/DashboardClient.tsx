'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { VesselGrid } from '@/features/dashboard/components/VesselGrid'
import { BowTable } from '@/features/dashboard/components/BowTable'
import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { Role } from '@/lib/types/roles'
import type { ClassOfVessel } from '@/hooks/useClassesOfVessel'
import { Anchor, FileBarChart2, ArrowRight, Inbox, TrendingUp, Package, Shield, FileText } from 'lucide-react'

const SECTION = {
    home: 'home',
    vessels: 'vessels',
    bow: 'bow',
    inventory: 'inventory',
} as const

type Section = (typeof SECTION)[keyof typeof SECTION]

interface SelectedClass {
    id: string
    name: string
}

interface DashboardClientProps {
    role: Role
    basePath: string
}

export function DashboardClient({ role, basePath }: DashboardClientProps) {
    const [activeSection, setActiveSection] = useState<Section>(SECTION.home)
    const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(null)

    const navigateTo = useCallback((section: Section) => {
        setActiveSection(section)
        if (section !== SECTION.bow) {
            setSelectedClass(null)
        }
    }, [])

    const handleSelectClass = useCallback((cls: ClassOfVessel) => {
        setSelectedClass({ id: cls.id, name: cls.name })
        setActiveSection(SECTION.bow)
    }, [])

    /** Build breadcrumb trail based on current section */
    const breadcrumbItems: BreadcrumbItem[] = (() => {
        switch (activeSection) {
            case SECTION.vessels:
                return [
                    { label: 'Dashboard', href: '#', onClick: () => navigateTo(SECTION.home) },
                    { label: 'Vessels' },
                ]
            case SECTION.bow:
                return [
                    { label: 'Dashboard', href: '#', onClick: () => navigateTo(SECTION.home) },
                    { label: 'Vessels', href: '#', onClick: () => navigateTo(SECTION.vessels) },
                    { label: selectedClass?.name || 'Bow Numbers' },
                ]
            case SECTION.inventory:
                return [
                    { label: 'Dashboard', href: '#', onClick: () => navigateTo(SECTION.home) },
                    { label: 'Inventory Report' },
                ]
            case SECTION.home:
            default:
                return [{ label: 'Dashboard' }]
        }
    })()

    return (
        <div className="p-4 space-y-3">
            <Breadcrumbs items={breadcrumbItems} />

            {/* ── Default: Bento Grid Layout ── */}
            {activeSection === SECTION.home && (
                <div className="space-y-3">
                    {/* Hero Card */}
                    <div className="relative overflow-hidden  bg-surface border border-primary/40 p-3 text-foreground shadow-card sm:p-4 lg:p-10 border-l-4 border-l-accent">
                        <div className="relative z-10">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center bg-accent/20 border border-accent/40">
                                    <Shield className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-foreground-muted">Inventory System</p>
                                    <p className="text-xs font-semibold text-accent">{role.toUpperCase()} Portal</p>
                                </div>
                            </div>
                            <div className="flex items-end gap-2 mb-3">
                                <span className="text-[32px] font-bold leading-tight text-foreground sm:text-5xl">Overview</span>
                            </div>
                            <p className="max-w-xl text-sm leading-6 text-foreground-muted">
                                Manage your vessels, equipment, and inventory efficiently from one dashboard.
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
                        <Link
                            href={`${basePath}/inventory-report`}
                            className="group relative overflow-hidden border border-primary/30 bg-surface p-3 text-left shadow-card transition-all duration-150 hover:border-accent/60 hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-accent sm:p-4 border-t-2 border-t-accent/40"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-8 w-8 items-center justify-center bg-accent/15 border border-accent/30">
                                    <FileText className="w-6 h-6 text-accent" />
                                </div>
                                <TrendingUp className="w-4 h-4 text-success" />
                            </div>
                            <h3 className="text-foreground font-bold text-[16px] mb-1">Inventory Report</h3>
                            <p className="text-foreground-muted text-xs mb-3">View and search all inventory items</p>
                            <span className="inline-flex items-center gap-1.5 bg-accent/20 border border-accent/40 px-4 py-1.5 text-xs font-bold text-accent transition-all group-hover:bg-accent group-hover:text-white">
                                Open <ArrowRight className="w-3 h-3" />
                            </span>
                        </Link>

                        <Link
                            href={`${basePath}/vessels`}
                            className="group relative overflow-hidden border border-primary/30 bg-surface p-3 text-left shadow-card transition-all duration-150 hover:border-accent/60 hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-accent sm:p-4 border-t-2 border-t-accent/40"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-8 w-8 items-center justify-center bg-accent/15 border border-accent/30">
                                    <Anchor className="w-6 h-6 text-accent" />
                                </div>
                                <TrendingUp className="w-4 h-4 text-success" />
                            </div>
                            <h3 className="text-foreground font-bold text-[16px] mb-1">Vessels</h3>
                            <p className="text-foreground-muted text-xs mb-3">Browse all classes of vessel</p>
                            <span className="inline-flex items-center gap-1.5 bg-accent/20 border border-accent/40 px-4 py-1.5 text-xs font-bold text-accent transition-all group-hover:bg-accent group-hover:text-white">
                                Open <ArrowRight className="w-3 h-3" />
                            </span>
                        </Link>

                        <Link
                            href={`${basePath}/reports`}
                            className="group relative overflow-hidden border border-primary/30 bg-surface p-3 text-left shadow-card transition-all duration-150 hover:border-accent/60 hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-accent sm:p-4 border-t-2 border-t-accent/40"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-8 w-8 items-center justify-center bg-accent/15 border border-accent/30">
                                    <FileBarChart2 className="w-6 h-6 text-accent" />
                                </div>
                                <TrendingUp className="w-4 h-4 text-success" />
                            </div>
                            <h3 className="text-foreground font-bold text-[16px] mb-1">Reports</h3>
                            <p className="text-foreground-muted text-xs mb-3">View and generate summary reports</p>
                            <span className="inline-flex items-center gap-1.5 bg-accent/20 border border-accent/40 px-4 py-1.5 text-xs font-bold text-accent transition-all group-hover:bg-accent group-hover:text-white">
                                Open <ArrowRight className="w-3 h-3" />
                            </span>
                        </Link>
                    </div>
                </div>
            )}

            {/* ── Vessels Section ── */}
            {activeSection === SECTION.vessels && (
                <VesselGrid onSelectClass={handleSelectClass} />
            )}

            {/* ── Bow Numbers Section ── */}
            {activeSection === SECTION.bow && selectedClass && (
                <BowTable classId={selectedClass.id} className={selectedClass.name} />
            )}

            {/* ── Inventory Report Section ── */}
            {activeSection === SECTION.inventory && (
                <InventoryReportPage />
            )}
        </div>
    )
}

