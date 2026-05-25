import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { BowReportsClient } from '@/features/reports/components/BowReportsClient'

export default function EncoderReportsPage() {
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/encoder' },
    { label: 'Reports' },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <BowReportsClient basePath="/encoder" />
    </div>
  )
}
