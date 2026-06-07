import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Global Inventory View | Viewer',
    description: 'View global inventory',
}

export default function ViewerInventoryReportPage() {
    return <InventoryReportPage role={ROLES.viewer} />
}
