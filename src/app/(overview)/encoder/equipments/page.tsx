import { EquipmentsPageClient } from '@/features/equipment/components/EquipmentsPageClient'
import { ROLES } from '@/lib/types/roles'

export default function EncoderEquipmentsPage() {
    return <EquipmentsPageClient role={ROLES.encoder} basePath="/encoder" />
}
