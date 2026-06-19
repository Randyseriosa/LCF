'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { VesselGrid } from '@/features/overview/components/VesselGrid'
import { BowTable } from '@/features/overview/components/BowTable'
import { Role } from '@/lib/types/roles'
import type { ClassOfVessel } from '@/hooks/useClassesOfVessel'
import { Shield, Package, Ship, Wrench } from 'lucide-react'

const SECTION = {
    home: 'home',
    vessels: 'vessels',
    bow: 'bow',
} as const

type Section = (typeof SECTION)[keyof typeof SECTION]

interface SelectedClass {
    id: string
    name: string
}

interface OverviewClientProps {
    role: Role
    basePath: string
}

const MANAGEMENT_TABS = [
    { label: 'HLCF INVENTORY MANAGEMENT', href: (base: string) => `${base}/hlcf`, icon: Package },
    { label: 'Vessel Management', href: (base: string) => `${base}/vessels`, icon: Ship },
    { label: 'Equipment Management', href: (base: string) => `${base}/equipments`, icon: Wrench },
] as const

export function OverviewClient({ role, basePath }: OverviewClientProps) {
    const [activeSection, setActiveSection] = useState<Section>(SECTION.home)
    const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(null)
    const pathname = usePathname()

    const handleSelectClass = useCallback((cls: ClassOfVessel) => {
        setSelectedClass({ id: cls.id, name: cls.name })
        setActiveSection(SECTION.bow)
    }, [])

    return (
        <div className="flex flex-col flex-1 space-y-[30px]">
            {/* ── Default: Bento Grid Layout ── */}
            {activeSection === SECTION.home && (
                <div className="flex flex-col flex-1 space-y-0">
                    <PageHeader
                        title="Overview"
                        description="Manage HLCF Inventory, Vessels, and Equipment"
                        subtitle="Equipment Management and Monitoring System"
                        Icon={Shield}
                        bannerImage="/images/banners/banner-general-button.webp"
                        actions={
                            MANAGEMENT_TABS.map((tab) => {
                                const href = tab.href(basePath)
                                const isActive = pathname === href || pathname.startsWith(href + '/')
                                const Icon = tab.icon
                                return (
                                    <Link
                                        key={tab.label}
                                        href={href}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border ${isActive
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white text-primary border-primary hover:bg-primary hover:text-white'
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        {tab.label}
                                    </Link>
                                )
                            })
                        }
                    />

                    <div className="relative w-full flex-1 overflow-hidden border border-gray-200 bg-gray-50">
                        <img
                            src="/images/main/welcome.webp"
                            alt="Welcome"
                            className="w-full h-full object-cover"
                        />
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
        </div>
    )
}
