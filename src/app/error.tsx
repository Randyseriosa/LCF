'use client'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-4 bg-background text-foreground">
            <div className="bg-surface p-4 shadow-sm border border-error/20 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-error/10 text-error flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
                <p className="text-gray-500 mb-3 text-sm">{error.message || "An unexpected error occurred."}</p>
                <button
                    onClick={() => reset()}
                    className="bg-primary text-white px-4 py-2 hover:bg-primary/90 transition-colors w-full"
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
