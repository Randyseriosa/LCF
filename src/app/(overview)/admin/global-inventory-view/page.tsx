import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Global Inventory View | Admin',
    description: 'View and manage global inventory',
}

export default function AdminInventoryReportPage() {
    return <InventoryReportPage role={ROLES.admin} />
}
