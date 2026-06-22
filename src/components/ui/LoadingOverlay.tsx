'use client'

import React from 'react'

interface LoadingOverlayProps {
  isOpen: boolean
  message: string
}

export function LoadingOverlay({ isOpen, message }: LoadingOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 md:left-64 z-[9999] flex flex-col items-center justify-center bg-white/20 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-4">
        {/* Tactical Loader */}
        <div className="loader"></div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">{message}</p>
        </div>
      </div>

      <style jsx>{`
        .loader {
          width: 60px;
          aspect-ratio: 4;
          background: radial-gradient(circle closest-side, #000080 90%, #0000) 0/calc(100%/3) 100% space;
          clip-path: inset(0 100% 0 0);
          animation: l1 1s steps(4) infinite;
        }
        @keyframes l1 {
          to { clip-path: inset(0 -34% 0 0); }
        }
      `}</style>
    </div>
  )
}
