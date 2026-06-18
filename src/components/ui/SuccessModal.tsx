'use client'

import React, { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

interface SuccessModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    message: string
}

export function SuccessModal({
    isOpen,
    onClose,
    title,
    message,
}: SuccessModalProps) {
    const [isExiting, setIsExiting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setIsExiting(false)
            // Start exit animation after 2.5 seconds (leaving 0.5s for the animation itself)
            const timer = setTimeout(() => {
                setIsExiting(true)
                // Call onClose after animation completes
                setTimeout(() => {
                    onClose()
                }, 500)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-8 pb-12 pointer-events-none">
            {/* Success Message UI - Lower Centered / Auto-disappearing with Exit Animation */}
            <div className={`
                relative bg-surface border-2 border-primary shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-lg p-4 
                pointer-events-auto
                ${isExiting ? 'opacity-0' : 'opacity-100'}
            `}>
                <div className="flex items-center gap-4">
                    {/* Tactical Success Icon */}
                    <div className="shrink-0 w-12 h-12 bg-secondary/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-foreground" strokeWidth={3} />
                    </div>

                    {/* Brief Tactical Message */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-foreground uppercase tracking-[0.2em] mb-0.5">
                            {title}
                        </h3>
                        <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider line-clamp-2">
                            {message}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
