import { SettingsPageClient } from '@/features/settings/components/SettingsPageClient'
import { ROLES } from '@/lib/types/roles'

export default function AdminSettingsPage() {
    return <SettingsPageClient role={ROLES.admin} />
}
