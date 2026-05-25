import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { BowReportsClient } from '@/features/reports/components/BowReportsClient'

export default function AdminReportsPage() {
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Reports' },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <BowReportsClient basePath="/admin" />
    </div>
  )
}
