import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const IS_PROD = process.env.NODE_ENV === 'production'

export async function POST(request: Request) {
    const { access_token, refresh_token } = await request.json()

    if (!access_token || !refresh_token) {
        return NextResponse.json({ error: 'Tokens are required' }, { status: 400 })
    }

    const cookieStore = await cookies()

    cookieStore.set('access_token', access_token, {
        httpOnly: false,
        secure: IS_PROD,
        sameSite: 'strict',
        maxAge: 3600,
        path: '/',
    })

    cookieStore.set('refresh_token', refresh_token, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'strict',
        maxAge: 604800,
        path: '/',
    })

    return NextResponse.json({ success: true })
}

export async function DELETE() {
    const cookieStore = await cookies()
    cookieStore.delete('access_token')
    cookieStore.delete('refresh_token')
    return NextResponse.json({ success: true })
}
