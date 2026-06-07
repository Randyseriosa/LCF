import { MonthlyReportClient } from '@/features/reports/components/MonthlyReportClient'

export const metadata = {
    title: 'Monthly Report | LCF WCEIS',
    description: 'View and import monthly inventory reports.',
}

export default function AdminMonthlyReportPage() {


    return (
        <div className="p-4 space-y-3">

            <MonthlyReportClient basePath="/admin" showImport={true} />
        </div>
    )
}
