import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { BowReportDetailsClient } from '@/features/reports/components/BowReportDetailsClient'

interface PageProps {
  params: Promise<{
    bowNumber: string
  }>
  searchParams: Promise<{
    month?: string
    year?: string
  }>
}

export default async function AdminBowReportPage({ params, searchParams }: PageProps) {
  const { bowNumber } = await params
  const resolvedSearchParams = await searchParams
  const month = resolvedSearchParams.month ? parseInt(resolvedSearchParams.month, 10) : new Date().getMonth()
  const year = resolvedSearchParams.year ? parseInt(resolvedSearchParams.year, 10) : new Date().getFullYear()

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Overview', href: '/admin' },
    { label: 'Monthly Report', href: '/admin/monthly-report' },
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
        reportsPath="/admin/monthly-report"
      />
    </div>
  )
}
