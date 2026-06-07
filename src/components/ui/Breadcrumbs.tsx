'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
    label: string
    href?: string
    onClick?: () => void
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center gap-1.5 text-sm">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1

                    return (
                        <li key={index} className="flex items-center gap-1.5">
                            {index > 0 && (
                                <ChevronRight className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                            )}
                            {isLast || (!item.href && !item.onClick) ? (
                                <span className="font-black text-primary text-[24px] tracking-[0.1em] uppercase">
                                    {item.label}
                                </span>
                            ) : item.onClick ? (
                                <button
                                    type="button"
                                    onClick={item.onClick}
                                    className="text-gray-400 hover:text-primary transition-colors font-black text-[24px] tracking-[0.1em] uppercase bg-transparent border-none cursor-pointer p-0"
                                >
                                    {item.label}
                                </button>
                            ) : (
                                <Link
                                    href={item.href!}
                                    className="text-gray-400 hover:text-primary transition-colors font-black text-[24px] tracking-[0.1em] uppercase"
                                >
                                    {item.label}
                                </Link>
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
