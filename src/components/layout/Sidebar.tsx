'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileSpreadsheet, Anchor, Box, Settings, LogOut, Shield } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { ROLES, type Role } from '@/lib/types/roles'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export function Sidebar({ role }: { role: Role }) {
    const pathname = usePathname()
    const [showLogoutModal, setShowLogoutModal] = useState(false)

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
                { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
                { name: 'HLCF', href: '/admin/hlcf', icon: Box },
                { name: 'Vessels', href: '/admin/vessels', icon: Anchor },
                { name: 'Equipments', href: '/admin/equipments', icon: Box },
                { name: 'Settings', href: '/admin/settings', icon: Settings },
                { name: 'Users', href: '/admin/users', icon: Users }
            )
            break
        case ROLES.encoder:
        case ROLES.viewer:
            navItems.push(
                { name: 'Dashboard', href: `/${role}`, icon: LayoutDashboard },
                { name: 'HLCF', href: `/${role}/hlcf`, icon: Box },
            )

            if (role === ROLES.encoder) {
                navItems.push({ name: 'Import', href: `/${role}/import`, icon: FileSpreadsheet })
            }

            navItems.push(
                { name: 'Vessels', href: `/${role}/vessels`, icon: Anchor },
                { name: 'Equipments', href: `/${role}/equipments`, icon: Box },
                { name: 'Settings', href: `/${role}/settings`, icon: Settings }
            )
            break
    }

    return (
        <aside className="fixed inset-x-3 bottom-0 z-50 flex h-16 items-center bg-sidebar px-3 shadow-sm md:inset-y-0 md:left-0 md:right-auto md:h-screen md:w-64 md:flex-col md:items-stretch md:px-0 md:py-3 md:gap-4 border-r border-foreground/10">
            {/* Logo */}
            <div className="hidden flex-col items-center gap-2 bg-surface justify-center px-4 py-4 mx-4 md:flex border border-foreground/10">
                <img
                    src="/images/logo/logo.png"
                    alt="LCFPF Logo"
                    className="w-20 h-20 object-contain"
                />
                <span className="text-sidebar-foreground font-bold tracking-widest text-sm whitespace-nowrap">
                    LCF
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-1 items-center justify-around gap-1 md:flex-col md:items-stretch md:justify-start md:gap-1 md:px-4">
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
                            className={`h-11 flex items-center gap-3 transition-all duration-150 w-full justify-start px-4 border-l-2 ${isActive
                                ? 'bg-primary/10 border-l-primary text-primary font-bold'
                                : 'border-l-transparent text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-surface hover:border-l-primary/30'
                                }`}
                        >
                            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                            <span className="text-xs font-semibold whitespace-nowrap">
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            {/* Logout */}
            <button
                onClick={handleLogoutClick}
                className="hidden h-11 items-center justify-start gap-3 px-4 mx-4 md:flex text-sidebar-foreground/70 hover:text-error hover:bg-error-bg border border-transparent hover:border-error/30 transition-all duration-150 w-[calc(100%-2rem)]"
            >
                <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                <span className="text-xs font-semibold whitespace-nowrap">
                    Logout
                </span>
            </button>

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
