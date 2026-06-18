import { PageHeader } from '@/components/layout/PageHeader'
import { ArrowLeftRight } from 'lucide-react'
import { BowInventoryTransfer } from '@/features/hlcf/components/BowInventoryTransfer'

export const metadata = {
    title: 'Item Displacement | Viewer',
    description: 'Transfer items between vessels',
}

export default function ItemDisplacementPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Item Displacement"
                description="Transfer Items"
                Icon={ArrowLeftRight}
            />
            <div className="bg-surface border border-foreground/5 shadow-card p-6">
                <BowInventoryTransfer />
            </div>
        </div>
    )
}
