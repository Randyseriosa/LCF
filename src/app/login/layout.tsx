import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Login - Info System Overview',
    description: 'Sign in to access the system overview and manage the inventory system.',
}

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
