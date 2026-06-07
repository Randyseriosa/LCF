import React from 'react'
import { LucideIcon, ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
    /** The main title of the page */
    title: string
    /** Optional short description or status below the title */
    description?: string
    /** Optional system-level subtitle above the title (e.g. for Overview) */
    subtitle?: string
    /** Optional Lucide icon to display next to the text */
    Icon?: LucideIcon
    /** Optional action buttons or links for the right side */
    actions?: React.ReactNode
    /** Optional callback for a back button in the icon area */
    onBack?: () => void
    /** Optional banner image URL to use as header background (right-side decorative) */
    bannerImage?: string
}
/**
 * A unified header component for all pages in the Anchor Point Inventory System.
 * Matches the tactical, naval maritime aesthetic with sharp edges and deep navy accents.
 */
export function PageHeader({ title, description, subtitle, Icon, actions, onBack, bannerImage }: PageHeaderProps) {
    const hasBanner = !!bannerImage

    return (
        <div className="relative bg-white border border-gray-200 overflow-hidden">
            {/* Banner photo — full bleed behind the header, visible on the right */}
            {hasBanner && (
                <div
                    className="absolute inset-0 bg-cover bg-right bg-no-repeat z-0"
                    style={{ backgroundImage: `url(${bannerImage})` }}
                    aria-hidden="true"
                />
            )}
            {/* Content panel — now with transparent background when banner is present */}
            <div className={`relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 md:p-10 border-b border-gray-100 ${hasBanner ? 'bg-transparent' : 'bg-white'}`}>
                <div className="flex items-center gap-4">
                    {onBack ? (
                        <button
                            onClick={onBack}
                            className="flex h-12 w-12 items-center justify-center bg-gray-50 border border-gray-100 shrink-0 hover:bg-gray-100 transition-colors group"
                            title="Go Back"
                        >
                            <ArrowLeft className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" aria-hidden="true" />
                        </button>
                    ) : Icon && (
                        <div className="flex h-12 w-12 items-center justify-center bg-gray-50 border border-gray-100 shrink-0">
                            <Icon className="w-6 h-6 text-slate-400" aria-hidden="true" />
                        </div>
                    )}
                    <div className="space-y-0.5">
                        {subtitle && (
                            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary leading-none">
                                {subtitle}
                            </p>
                        )}
                        <p className="text-xl font-black text-gray-900 uppercase tracking-tight leading-tight">
                            {title}
                        </p>
                        {description && (
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {actions}
                    </div>
                )}
            </div>

            {/* Tactical Accent Bar */}
            <div className="relative h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        </div>
    )
}
