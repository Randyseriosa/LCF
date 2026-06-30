import React from 'react'
import { Metadata } from 'next'

import { PageHeader } from '@/components/layout/PageHeader'
import { Archive } from 'lucide-react'
import { RetiredItemsClient } from '@/features/items/components/RetiredItemsClient'

export const metadata: Metadata = {
    title: 'Item Management | Admin',
    description: 'Manage decommissioned equipment and inventory',
}

export default function RetiredItemsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Item Management"
                description="Manage decommissioned equipment and inventory"
                Icon={Archive}
                bannerImage="/images/banners/banner-general.webp"
            />

            <RetiredItemsClient />
        </div>
    )
}
