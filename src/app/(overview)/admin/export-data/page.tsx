import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Export Data | Admin',
    description: 'Export global inventory data',
}

export default function AdminExportDataPage() {
    return <InventoryReportPage role={ROLES.admin} />
}
