import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Export Data | Encoder',
    description: 'Export global inventory data',
}

export default function EncoderExportDataPage() {
    return <InventoryReportPage role={ROLES.encoder} />
}
