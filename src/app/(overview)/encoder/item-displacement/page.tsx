import { ItemDisplacementClient } from '@/features/hlcf/components/ItemDisplacementClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Item Displacement | Encoder',
    description: 'Transfer items between vessels',
}

export default function ItemDisplacementPage() {
    return <ItemDisplacementClient role={ROLES.encoder} />
}
