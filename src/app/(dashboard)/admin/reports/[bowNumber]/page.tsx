import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { BowReportDetailsClient } from '@/features/reports/components/BowReportDetailsClient'

interface PageProps {
  params: {
    bowNumber: string
  }
  searchParams: {
    month?: string
    year?: string
  }
}

export default function AdminBowReportPage({ params, searchParams }: PageProps) {
  const bowNumber = params.bowNumber
  const month = searchParams.month ? parseInt(searchParams.month, 10) : new Date().getMonth()
  const year = searchParams.year ? parseInt(searchParams.year, 10) : new Date().getFullYear()

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Reports', href: '/admin/reports' },
    { label: bowNumber },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <BowReportDetailsClient
        bowNumber={bowNumber}
        month={month}
        year={year}
        basePath="/admin"
        reportsPath="/admin/reports"
      />
    </div>
  )
}
