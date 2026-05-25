import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { BowReportsClient } from '@/features/reports/components/BowReportsClient'

export default function ViewerReportsPage() {
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/viewer' },
    { label: 'Reports' },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <BowReportsClient basePath="/viewer" />
    </div>
  )
}
