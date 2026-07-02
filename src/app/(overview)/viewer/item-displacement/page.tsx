import { ItemDisplacementClient } from '@/features/hlcf/components/ItemDisplacementClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Item Displacement | Viewer',
    description: 'View history of item transfers',
}

export default function ItemDisplacementPage() {
    return <ItemDisplacementClient role={ROLES.viewer} />
}
