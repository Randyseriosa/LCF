export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary animate-spin" />
                <p className="text-gray-500 font-medium">Loading content...</p>
            </div>
        </div>
    )
}
