import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
}
