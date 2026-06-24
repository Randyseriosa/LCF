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
        <div className="flex h-screen overflow-hidden bg-white">
            <Sidebar role={role} />
            <main className="flex flex-col flex-1 overflow-y-auto bg-white p-[30px] md:ml-64">
                {children}
            </main>
        </div>
    )
}
