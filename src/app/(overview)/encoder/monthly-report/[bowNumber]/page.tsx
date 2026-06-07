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

export default async function EncoderBowReportPage({ params, searchParams }: PageProps) {
  const { bowNumber } = await params

  // Require month and year parameters
  if (!searchParams.month || !searchParams.year) {
    return (
      <div className="p-4 space-y-3">
        <div className=" bg-error-bg p-3 shadow-card border border-error/20">
          <p className="text-error">Month and year parameters are required to view monthly report items.</p>
        </div>
      </div>
    )
  }

  const month = parseInt(searchParams.month, 10)
  const year = parseInt(searchParams.year, 10)

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Overview', href: '/encoder' },
    { label: 'Monthly Report', href: '/encoder/monthly-report' },
    { label: bowNumber },
  ]

  return (
    <div className="p-4 space-y-3">
      <Breadcrumbs items={breadcrumbItems} />
      <BowReportDetailsClient
        bowNumber={bowNumber}
        month={month}
        year={year}
        basePath="/encoder"
        reportsPath="/encoder/monthly-report"
      />
    </div>
  )
}
