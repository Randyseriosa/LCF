import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { ImportPageClient } from '@/features/import/components/ImportPageClient'

export default function EncoderImportPage() {
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/encoder' },
    { label: 'Import' },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <ImportPageClient />
    </div>
  )
}
