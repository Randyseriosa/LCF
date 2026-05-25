import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Inventory Report | Viewer',
    description: 'View inventory report',
}

export default function ViewerInventoryReportPage() {
    return <InventoryReportPage role={ROLES.viewer} />
}
