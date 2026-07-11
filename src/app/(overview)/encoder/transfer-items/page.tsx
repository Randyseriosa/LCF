import { TransferItemsClient } from '@/features/hlcf/components/TransferItemsClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Transfer Items | Encoder',
    description: 'Transfer items between vessels',
}

export default function TransferItemsPage() {
    return <TransferItemsClient role={ROLES.encoder} />
}
