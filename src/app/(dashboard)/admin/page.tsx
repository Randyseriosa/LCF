import { DashboardClient } from '@/features/dashboard/components/DashboardClient'

export default function AdminDashboardPage() {
    return <DashboardClient role="admin" basePath="/admin" />
}
