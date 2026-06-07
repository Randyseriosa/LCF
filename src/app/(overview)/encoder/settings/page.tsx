import { SettingsPageClient } from '@/features/settings/components/SettingsPageClient'
import { ROLES } from '@/lib/types/roles'

export default function EncoderSettingsPage() {
    return <SettingsPageClient role={ROLES.encoder} />
}
