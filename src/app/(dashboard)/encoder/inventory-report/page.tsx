import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Inventory Report | Encoder',
    description: 'View and filter inventory report',
}

export default function EncoderInventoryReportPage() {
    return <InventoryReportPage role={ROLES.encoder} />
}
