import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Login - Info System Dashboard',
    description: 'Sign in to access your dashboard and manage the inventory system.',
}

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
