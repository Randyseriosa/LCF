import { VesselsPageClient } from '@/features/vessels/components/VesselsPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Vessels View | Viewer',
    description: 'View class of vessels and bow numbers',
}

export default function ViewerVesselsPage() {
    return <VesselsPageClient role={ROLES.viewer} basePath="/viewer" />
}
