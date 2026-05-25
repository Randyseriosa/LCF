import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { BowReportDetailsClient } from '@/features/reports/components/BowReportDetailsClient'

interface PageProps {
  params: Promise<{
    bowNumber: string
  }>
  searchParams: {
    month?: string
    year?: string
  }
}

export default async function ViewerBowReportPage({ params, searchParams }: PageProps) {
  const { bowNumber } = await params
  const month = searchParams.month ? parseInt(searchParams.month, 10) : new Date().getMonth()
  const year = searchParams.year ? parseInt(searchParams.year, 10) : new Date().getFullYear()

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/viewer' },
    { label: 'Reports', href: '/viewer/reports' },
    { label: bowNumber },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <BowReportDetailsClient
        bowNumber={bowNumber}
        month={month}
        year={year}
        basePath="/viewer"
        reportsPath="/viewer/reports"
      />
    </div>
  )
}
