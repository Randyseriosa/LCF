import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Retired Items | Viewer',
    description: 'Manage decommissioned equipment and inventory',
}

export default function RetiredItemsPage() {
    return (
        <div className="p-6 h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-2xl font-bold tracking-widest uppercase text-foreground">Retired Items</h1>
                <p className="text-sm text-foreground-muted mt-1 uppercase tracking-wider">Manage decomissioned equipment and inventory.</p>
            </div>

            <div className="flex-1 bg-surface border border-primary/20 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4 bg-primary/5">
                        <span className="text-primary text-2xl font-bold">!</span>
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">Placeholder View</h2>
                    <p className="text-foreground-muted tracking-wide mt-2">Retired items module is currently under development.</p>
                </div>
            </div>
        </div>
    )
}
