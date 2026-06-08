'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileSpreadsheet, Box, Settings, LogOut, Shield, Archive, ArrowLeftRight, FileBarChart2, FileText } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { ROLES, type Role } from '@/lib/types/roles'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export function Sidebar({ role }: { role: Role }) {
    const pathname = usePathname()
    const [showLogoutModal, setShowLogoutModal] = useState(false)

    // Clear monthly report state when navigating to other main tabs
    React.useEffect(() => {
        const isMonthlyReport = pathname.includes('/monthly-report')
        if (!isMonthlyReport) {
            const keysToClear = [
                'lcf_monthly_report_month',
                'lcf_monthly_report_year',
                'lcf_monthly_report_bowFilter',
                'lcf_monthly_report_statusFilter',
                'lcf_monthly_report_hasAction'
            ]
            keysToClear.forEach(key => sessionStorage.removeItem(key))
        }
    }, [pathname])

    const handleLogout = async () => {
        await signOut()
    }

    const handleLogoutClick = () => {
        setShowLogoutModal(true)
    }

    const handleLogoutConfirm = () => {
        setShowLogoutModal(false)
        handleLogout()
    }

    const navItems: { name: string; href: string; icon: React.ElementType }[] = []

    switch (role) {
        case ROLES.admin:
            navItems.push(
                { name: 'Overview', href: '/admin', icon: LayoutDashboard },
                { name: 'Global Inventory View', href: '/admin/global-inventory-view', icon: FileText },
                { name: 'Items Displacement', href: '/admin/items-displacement', icon: ArrowLeftRight },
                { name: 'Monthly Report', href: '/admin/monthly-report', icon: FileBarChart2 },
                { name: 'Retired Items', href: '/admin/retired-items', icon: Archive },
                { name: 'Settings', href: '/admin/settings', icon: Settings },
                { name: 'Users', href: '/admin/users', icon: Users }
            )
            break
        case ROLES.encoder:
        case ROLES.viewer:
            navItems.push(
                { name: 'Overview', href: `/${role}`, icon: LayoutDashboard },
                { name: 'Global Inventory View', href: `/${role}/global-inventory-view`, icon: FileText },
                { name: 'Items Displacement', href: `/${role}/items-displacement`, icon: ArrowLeftRight },
                { name: 'Monthly Report', href: `/${role}/monthly-report`, icon: FileBarChart2 },
                { name: 'Retired Items', href: `/${role}/retired-items`, icon: Archive },
                { name: 'Settings', href: `/${role}/settings`, icon: Settings }
            )
            break
    }

    return (
        <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200">
            {/* Header Block */}
            <div className="flex flex-col items-center gap-3 px-6 py-10">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gray-100 bg-white p-1">
                    <img
                        src="/images/logo/logo.png"
                        alt="LCF Philippine Fleet Emblem"
                        className="h-full w-full object-contain rounded-full"
                    />
                </div>
                <span className="text-primary font-bold tracking-[0.2em] text-lg">
                    LCF
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-1 flex-col gap-1 px-0 py-4">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isRoot = item.href === `/${role}`
                    const isActive = isRoot
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`group relative flex h-12 items-center gap-3 px-6 transition-colors ${isActive
                                ? 'text-[#4A5568] bg-gray-50'
                                : 'text-gray-500 hover:text-primary hover:bg-gray-50'
                                }`}
                        >
                            {/* Active Accent Line */}
                            {isActive && (
                                <div className="absolute left-0 top-0 h-full w-[3px] bg-primary" />
                            )}
                            <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : ''}`} strokeWidth={2} />
                            <span className={`text-[13px] font-bold tracking-wider uppercase ${isActive ? 'text-[#4A5568]' : ''}`}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            {/* Footer (Logout) */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogoutClick}
                    className="flex w-full h-12 items-center gap-3 px-6 text-gray-500 hover:text-error hover:bg-error-bg transition-colors"
                >
                    <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
                    <span className="text-[13px] font-bold tracking-wider uppercase">
                        Logout
                    </span>
                </button>
            </div>

            {/* Logout Confirmation Modal */}
            <ConfirmModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={handleLogoutConfirm}
                title="Logout"
                message="Are you sure you want to logout?"
                confirmText="Logout"
                cancelText="Cancel"
            />
        </aside>
    )
}
