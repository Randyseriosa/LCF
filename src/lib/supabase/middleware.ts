import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROLES, USER_STATUS, isRole, type Role } from '@/lib/types/roles'

// Simple JWT verification (mirror of edge function implementation)
async function verifyJWTToken(token: string): Promise<any | null> {
    try {
        const [header, body, signature] = token.split('.')
        if (!header || !body || !signature) return null

        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

        // Reconstruct signature for verification
        const data = `${header}.${body}`
        const encoder = new TextEncoder()
        const keyData = encoder.encode(JWT_SECRET)
        const messageData = encoder.encode(data)

        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )

        const expectedSignature = await crypto.subtle.sign('HMAC', key, messageData)
        const expectedSignatureB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')

        if (signature !== expectedSignatureB64) return null

        const base64 = body.replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(base64))
        const now = Math.floor(Date.now() / 1000)

        if (payload.exp < now) return null // Token expired

        return payload
    } catch {
        return null
    }
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Get JWT from Authorization header or cookie
    const authHeader = request.headers.get('authorization')
    const tokenCookie = request.cookies.get('access_token')?.value
    const token = authHeader?.replace('Bearer ', '') || tokenCookie

    let user = null
    let getUserError = null

    if (token) {
        const payload = await verifyJWTToken(token)
        if (payload) {
            user = { id: payload.user_id, username: payload.username, role: payload.role, is_active: payload.is_active }
        } else {
            getUserError = { code: 'invalid_token' }
        }
    }

    // Clear invalid tokens
    if (getUserError?.code === 'invalid_token' || getUserError?.code === 'refresh_token_not_found') {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        const clearResponse = NextResponse.redirect(loginUrl)
        clearResponse.cookies.delete('access_token')
        clearResponse.cookies.delete('refresh_token')
        return clearResponse
    }

    const isLoginPage = request.nextUrl.pathname.startsWith('/login')
    const isApiAuthRoute = request.nextUrl.pathname.startsWith('/auth') || request.nextUrl.pathname.startsWith('/api/auth')
    const isStaticAsset = request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/static') ||
        request.nextUrl.pathname.includes('.')
    const isPublicRoute = isLoginPage || isApiAuthRoute || isStaticAsset

    if (
        !user &&
        !isPublicRoute
    ) {
        // no user, redirect to login unless on public route
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (isApiAuthRoute) {
        return supabaseResponse
    }

    if (user) {
        // JWT already contains role and is_active, no need to fetch profile
        const rawRole = user.role
        const rawIsActive = user.is_active
        const role: Role = isRole(rawRole) ? rawRole : ROLES.viewer
        const isActive = rawIsActive === USER_STATUS.active

        if (isLoginPage || request.nextUrl.pathname === '/') {
            const url = request.nextUrl.clone()
            if (!isActive) {
                url.pathname = '/inactive'
            } else {
                url.pathname = `/${role}`
            }
            return NextResponse.redirect(url)
        }

        if (!isActive && request.nextUrl.pathname !== '/inactive') {
            const url = request.nextUrl.clone()
            url.pathname = '/inactive'
            return NextResponse.redirect(url)
        }

        if (isActive && request.nextUrl.pathname === '/inactive') {
            const url = request.nextUrl.clone()
            url.pathname = `/${role}`
            return NextResponse.redirect(url)
        }

        // Role-based protection
        if (request.nextUrl.pathname.startsWith('/admin') && role !== ROLES.admin) {
            const url = request.nextUrl.clone()
            url.pathname = `/${role}`
            return NextResponse.redirect(url)
        }

        if (request.nextUrl.pathname.startsWith('/encoder') && !([ROLES.admin, ROLES.encoder] as Role[]).includes(role)) {
            const url = request.nextUrl.clone()
            url.pathname = `/${role}`
            return NextResponse.redirect(url)
        }

        if (role === ROLES.viewer && request.nextUrl.pathname.endsWith('/import')) {
            const url = request.nextUrl.clone()
            url.pathname = `/${role}`
            return NextResponse.redirect(url)
        }

        if (request.nextUrl.pathname.startsWith('/viewer')) {
            if (!([ROLES.admin, ROLES.encoder, ROLES.viewer] as Role[]).includes(role)) {
                const url = request.nextUrl.clone()
                url.pathname = `/${role}`
                return NextResponse.redirect(url)
            }
            if (role === ROLES.viewer) {
                const path = request.nextUrl.pathname
                const disallowedViewerPaths = [
                    '/viewer/vessels',
                    '/viewer/equipments'
                ]
                if (disallowedViewerPaths.some(p => path === p || path.startsWith(p + '/'))) {
                    const url = request.nextUrl.clone()
                    url.pathname = '/viewer'
                    return NextResponse.redirect(url)
                }
            }
        }
    }

    return supabaseResponse
}
