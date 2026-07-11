import { TransferItemsClient } from '@/features/hlcf/components/TransferItemsClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Transfer Items | Admin',
    description: 'Transfer items between vessels',
}

export default function TransferItemsPage() {
    return <TransferItemsClient role={ROLES.admin} />
}
