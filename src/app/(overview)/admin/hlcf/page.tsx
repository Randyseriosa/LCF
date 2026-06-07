import { HLCFPageClient } from '@/features/hlcf/components/HLCFPageClient'

export const metadata = {
  title: 'HLCF | Admin',
  description: 'View HLCF Inventory',
}

export default function HLCFPage() {
  return <HLCFPageClient basePath="/admin" />
}
