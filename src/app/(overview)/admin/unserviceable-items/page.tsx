import React from 'react'
import { Metadata } from 'next'

import { PageHeader } from '@/components/layout/PageHeader'
import { Archive } from 'lucide-react'
import { RetiredItemsClient } from '@/features/items/components/RetiredItemsClient'
import { ROLES } from '@/lib/types/roles'

export const metadata: Metadata = {
    title: 'Unserviceable Items | Admin',
    description: 'Manage decommissioned equipment and inventory',
}

export default function RetiredItemsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Unserviceable Items"
                description="Manage decommissioned equipment and inventory"
                Icon={Archive}
                bannerImage="/images/banners/banner-general.webp"
            />

            <RetiredItemsClient role={ROLES.admin} />
        </div>
    )
}
