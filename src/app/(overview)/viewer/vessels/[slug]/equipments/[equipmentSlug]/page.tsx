import { EquipmentManagementPageClient } from '@/features/vessels/components/EquipmentManagementPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
    title: 'Equipment Management | Viewer',
    description: 'Manage equipment for bow number',
}

export default async function ViewerEquipmentManagementPage({
    params,
}: {
    params: Promise<{ slug: string; equipmentSlug: string }>
}) {
    const { slug } = await params
    return <EquipmentManagementPageClient slug={slug} role={ROLES.viewer} />
}
