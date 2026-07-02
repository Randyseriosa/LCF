import { HLCFPageClient } from '@/features/hlcf/components/HLCFPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
  title: 'OLCF6 | Viewer',
  description: 'View OLCF6 Inventory',
}

export default function HLCFPage() {
  return <HLCFPageClient basePath="/viewer" role={ROLES.viewer} />
}
