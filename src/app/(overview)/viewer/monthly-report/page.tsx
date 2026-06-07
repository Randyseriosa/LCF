import { MonthlyReportClient } from '@/features/reports/components/MonthlyReportClient'

export const metadata = {
    title: 'Monthly Report | LCF WCEIS',
    description: 'View monthly inventory report status.',
}

export default function ViewerMonthlyReportPage() {


    return (
        <div className="p-4 space-y-3">

            <MonthlyReportClient basePath="/viewer" showImport={false} />
        </div>
    )
}
