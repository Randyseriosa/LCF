import { BowEquipmentPageClient } from '@/features/vessels/components/BowEquipmentPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Bow Equipment | Viewer',
    description: 'View equipment for a bow number',
}

export default async function ViewerBowEquipmentPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    return <BowEquipmentPageClient slug={slug} role={ROLES.viewer} />
}
