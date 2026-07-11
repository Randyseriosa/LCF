import { TransferItemsClient } from '@/features/hlcf/components/TransferItemsClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Transfer Items | Viewer',
    description: 'View history of item transfers',
}

export default function TransferItemsPage() {
    return <TransferItemsClient role={ROLES.viewer} />
}
