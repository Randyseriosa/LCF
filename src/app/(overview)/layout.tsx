import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { ROLES, isRole, type Role } from '@/lib/types/roles'
import { getAuthUserServer } from '@/lib/auth-server'

export const metadata: Metadata = {
    title: 'Overview - Info System',
    description: 'Manage your inventory system efficiently.',
}

export default async function OverviewLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getAuthUserServer()

    if (!user) {
        redirect('/login')
    }

    const role: Role = isRole(user.role) ? user.role : ROLES.viewer

    return (
        <div className="flex min-h-screen bg-white">
            <Sidebar role={role} />
            <main className="flex-1 overflow-auto bg-white p-8 md:p-10 md:ml-64">
                {children}
            </main>
        </div>
    )
}
