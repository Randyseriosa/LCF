import { Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary rounded-full" />
                <p className="text-gray-500 font-medium">Loading contents...</p>
            </div>
        </div>
    )
}
