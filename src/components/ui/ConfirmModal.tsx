'use client'

import React from 'react'
import { X } from 'lucide-react'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    confirmButtonClassName?: string
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmButtonClassName = 'px-4 py-2.5 text-sm font-bold bg-accent text-white hover:bg-secondary-hover transition-colors border border-accent/50'
}: ConfirmModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface border border-primary/40 shadow-popover w-full max-w-md p-3">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-primary/20"
                >
                    <X className="w-5 h-5" strokeWidth={2} />
                </button>

                {/* Content */}
                <div className="pt-2">
                    <h3 className="text-[20px] font-bold text-foreground mb-2">
                        {title}
                    </h3>
                    <p className="text-sm font-normal text-foreground-muted mb-3">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-semibold text-foreground-muted hover:text-foreground hover:bg-primary/20 border border-primary/30 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={confirmButtonClassName}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
