import InventoryReportPage from '@/features/inventory-report/components/InventoryReportPage'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Global Inventory View | Encoder',
    description: 'View and filter global inventory',
}

export default function EncoderInventoryReportPage() {
    return <InventoryReportPage role={ROLES.encoder} />
}
