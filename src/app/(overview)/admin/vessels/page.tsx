import { VesselsPageClient } from '@/features/vessels/components/VesselsPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Vessels Management | Admin',
    description: 'Manage class of vessels and bow numbers',
}

export default function AdminVesselsPage() {
    return <VesselsPageClient role={ROLES.admin} basePath="/admin" />
}
