import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Inventory Report | Admin',
    description: 'View and manage inventory report',
}

export default function AdminInventoryReportPage() {
    return <InventoryReportPage role={ROLES.admin} />
}
