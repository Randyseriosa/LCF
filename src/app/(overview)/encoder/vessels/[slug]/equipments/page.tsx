import { BowEquipmentPageClient } from '@/features/vessels/components/BowEquipmentPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Bow Equipment | Encoder',
    description: 'View and manage equipment for a bow number',
}

export default async function EncoderBowEquipmentPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    return <BowEquipmentPageClient slug={slug} role={ROLES.encoder} />
}
