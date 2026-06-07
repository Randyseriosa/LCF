import { BowEquipmentPageClient } from '@/features/vessels/components/BowEquipmentPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Bow Equipment | Admin',
    description: 'View and manage equipment for a bow number',
}

export default async function AdminBowEquipmentPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    return <BowEquipmentPageClient slug={slug} role={ROLES.admin} />
}
