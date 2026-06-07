'use client'

import React from 'react'
import { Anchor, Ship, Loader2, ArrowRight } from 'lucide-react'
import { useClassesOfVessel, type ClassOfVessel } from '@/hooks/useClassesOfVessel'

/** Green monochromatic palette matching design system */
const CARD_COLORS = [
    { bg: 'bg-secondary/30', text: 'text-foreground', border: 'border-secondary/40', icon: 'text-foreground' },
    { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'text-primary' },
    { bg: 'bg-secondary/20', text: 'text-foreground', border: 'border-secondary/30', icon: 'text-foreground' },
    { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'text-primary' },
    { bg: 'bg-secondary/30', text: 'text-foreground', border: 'border-secondary/40', icon: 'text-foreground' },
    { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'text-primary' },
    { bg: 'bg-secondary/20', text: 'text-foreground', border: 'border-secondary/30', icon: 'text-foreground' },
    { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'text-primary' },
] as const

interface VesselGridProps {
    onSelectClass?: (cls: ClassOfVessel) => void
}

export function VesselGrid({ onSelectClass }: VesselGridProps) {
    const { classesOfVessel, loading, error } = useClassesOfVessel()

    if (loading) {
        return (
            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                        <Anchor className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-[20px] font-semibold text-foreground">Vessels</h2>
                </div>
                <div className="flex items-center justify-center py-3 text-foreground-muted">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Loading vessel classes…
                </div>
            </section>
        )
    }

    if (error) {
        return (
            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                        <Anchor className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-[20px] font-semibold text-foreground">Vessels</h2>
                </div>
                <div className="p-4 bg-error-bg border border-error/20 text-error text-sm">
                    {error}
                </div>
            </section>
        )
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
                    <Anchor className="w-5 h-5 text-foreground" />
                </div>
                <h2 className="text-[20px] font-semibold text-foreground">Vessels</h2>
            </div>

            {classesOfVessel.length === 0 ? (
                <div className=" bg-surface border border-foreground/10 p-4 text-center text-foreground-muted text-sm shadow-card">
                    No vessel classes found. Add one from the Vessels management page.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {classesOfVessel.map((cls, index) => {
                        const palette = CARD_COLORS[index % CARD_COLORS.length]
                        return (
                            <button
                                key={cls.id}
                                type="button"
                                onClick={() => onSelectClass?.(cls)}
                                className={`group relative  bg-surface border ${palette.border} p-3 text-left transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer`}
                            >
                                {/* Icon badge */}
                                <div className={`${palette.bg} w-8 h-8 flex items-center justify-center mb-4`}>
                                    <Ship className={`w-5 h-5 ${palette.icon}`} />
                                </div>

                                {/* Name */}
                                <h3 className="text-foreground font-semibold text-base leading-tight mb-1">
                                    {cls.name}
                                </h3>

                                {/* Subtle order label */}
                                <p className="text-foreground-muted text-xs mb-4">
                                    Sort Order: {cls.sort_order}
                                </p>

                                {/* CTA */}
                                <span className={`inline-flex items-center gap-1.5 ${palette.text} text-sm font-medium group-hover:gap-2.5 transition-all`}>
                                    View Bow Numbers <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
