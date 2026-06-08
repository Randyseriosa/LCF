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

export default async function EncoderBowReportPage({ params, searchParams }: PageProps) {
  const { bowNumber } = await params
  const { month: monthStr, year: yearStr } = await searchParams

  // Require month and year parameters
  if (!monthStr || !yearStr) {
    return (
      <div className="p-4 space-y-3">
        <div className=" bg-error-bg p-3 shadow-card border border-error/20">
          <p className="text-error">Month and year parameters are required to view monthly report items.</p>
        </div>
      </div>
    )
  }

  const month = parseInt(monthStr, 10)
  const year = parseInt(yearStr, 10)



  return (
    <div className="p-4 space-y-3">
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
