import { EquipmentsPageClient } from '@/features/equipment/components/EquipmentsPageClient'
import { ROLES } from '@/lib/types/roles'

export default function AdminEquipmentsPage() {
    return <EquipmentsPageClient role={ROLES.admin} basePath="/admin" />
}
