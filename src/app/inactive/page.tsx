import type { Metadata } from 'next'

import { getAuthUserServer } from '@/lib/auth-server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
    title: 'Account Inactive - Info System',
    description: 'Your account is currently inactive. Please contact your administrator.',
}

export default async function InactivePage() {
    const user = await getAuthUserServer()

    if (!user) {
        redirect('/login')
    }

    return (
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
            <section className="bg-surface shadow-sm max-w-md w-full p-4 text-center border border-gray-100">
                <div className="mx-auto w-16 h-16 bg-primary/10 flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                </div>

                <h1 className="font-['Inter'] font-semibold text-2xl text-foreground mb-3">
                    Account Inactive
                </h1>

                <p className="font-['Inter'] text-[14px] text-gray-500 mb-4 leading-relaxed">
                    Please contact your admin to activate your account. You will not be able to access the system overview until your account is approved.
                </p>

                <form action="/auth/signout" method="post">
                    <button
                        type="submit"
                        className="w-full bg-secondary hover:opacity-90 text-white font-['Inter'] font-medium text-[14px] py-3 transition-colors"
                    >
                        Sign out
                    </button>
                </form>
            </section>
        </main>
    )
}
