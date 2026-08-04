import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Export Data | Viewer',
    description: 'Export global inventory data',
}

export default function ViewerExportDataPage() {
    return <InventoryReportPage role={ROLES.viewer} />
}
