import { VesselsPageClient } from '@/features/vessels/components/VesselsPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Vessels View | Encoder',
    description: 'View class of vessels and bow numbers',
}

export default function EncoderVesselsPage() {
    return <VesselsPageClient role={ROLES.encoder} basePath="/encoder" />
}
