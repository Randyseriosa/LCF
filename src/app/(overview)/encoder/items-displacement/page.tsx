import { PageHeader } from '@/components/layout/PageHeader'
import { ArrowLeftRight } from 'lucide-react'
import { BowInventoryTransfer } from '@/features/hlcf/components/BowInventoryTransfer'

export const metadata = {
    title: 'Items Displacement | Encoder',
    description: 'Transfer items between vessels',
}

export default function ItemsDisplacementPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Items Displacement"
                description="Transfer Items"
                Icon={ArrowLeftRight}
            />
            <div className="bg-surface border border-foreground/5 shadow-card p-6">
                <BowInventoryTransfer />
            </div>
        </div>
    )
}
