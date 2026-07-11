import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const IS_PROD = process.env.NODE_ENV === 'production'

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const refresh_token = cookieStore.get('refresh_token')?.value

        if (!refresh_token) {
            return NextResponse.json({ error: 'Refresh token not found' }, { status: 401 })
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth-refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token }),
        })

        const data = await res.json()

        if (!res.ok || !data.access_token) {
            // Clear invalid cookies
            cookieStore.delete('access_token')
            cookieStore.delete('refresh_token')
            return NextResponse.json({ error: data.error || 'Failed to refresh token' }, { status: 401 })
        }

        cookieStore.set('access_token', data.access_token, {
            httpOnly: false,
            secure: IS_PROD,
            sameSite: 'strict',
            maxAge: 3600,
            path: '/',
        })

        if (data.refresh_token) {
            cookieStore.set('refresh_token', data.refresh_token, {
                httpOnly: true,
                secure: IS_PROD,
                sameSite: 'strict',
                maxAge: 604800,
                path: '/',
            })
        }

        return NextResponse.json({ success: true, access_token: data.access_token })
    } catch (err: any) {
        console.error('Refresh token API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
