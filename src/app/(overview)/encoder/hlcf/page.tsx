import { HLCFPageClient } from '@/features/hlcf/components/HLCFPageClient'
import { ROLES } from '@/lib/types/roles'

export const metadata = {
  title: 'OLCF6 | Encoder',
  description: 'View OLCF6 Inventory',
}

export default function HLCFPage() {
  return <HLCFPageClient basePath="/encoder" role={ROLES.encoder} />
}
