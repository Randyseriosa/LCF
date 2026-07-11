// Custom auth utilities for JWT-based authentication

export interface AuthUser {
    id: string
    username: string
    role: string
    is_active: string
}

// Simple JWT verification (mirror of middleware implementation)
async function verifyJWTToken(token: string): Promise<any | null> {
    try {
        const [header, body, signature] = token.split('.')
        if (!header || !body || !signature) return null

        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

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

        if (payload.exp < now) return null

        return payload
    } catch {
        return null
    }
}

// Get access token from cookie
export function getAccessToken(): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
}

function isTokenExpired(token: string): boolean {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return true
        const body = parts[1]
        const base64 = body.replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(base64))
        const now = Math.floor(Date.now() / 1000)
        // If token expires in less than 30 seconds (or is already expired), treat it as expired
        return payload.exp - 30 < now
    } catch {
        return true
    }
}

let activeRefreshPromise: Promise<string | null> | null = null

// Get valid access token from cookie, refreshing if expired
export async function getValidAccessToken(): Promise<string | null> {
    const token = getAccessToken()
    if (!token) return null

    if (isTokenExpired(token)) {
        if (activeRefreshPromise) {
            return activeRefreshPromise
        }

        activeRefreshPromise = (async () => {
            try {
                const res = await fetch('/api/auth/refresh', { method: 'POST' })
                if (res.ok) {
                    const data = await res.json()
                    if (data.access_token) {
                        return data.access_token
                    }
                }
            } catch (e) {
                console.error('Failed to refresh token client side:', e)
            } finally {
                activeRefreshPromise = null
            }
            return null
        })()

        return activeRefreshPromise
    }

    return token
}

// Get auth user from JWT, automatically refreshing token if expired
export async function getAuthUser(): Promise<AuthUser | null> {
    const token = await getValidAccessToken()
    if (!token) return null

    // Decode and read payload (signature was verified on server / will be verified by APIs)
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return null
        const body = parts[1]
        const base64 = body.replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(base64))

        return {
            id: payload.user_id,
            username: payload.username,
            role: payload.role,
            is_active: payload.is_active,
        }
    } catch {
        return null
    }
}

// Sign out — clear session cookies server-side then navigate to login
export async function signOut() {
    if (typeof window === 'undefined') return
    try {
        await fetch('/auth/signout', { method: 'POST', redirect: 'manual' })
    } catch {
        // Best-effort; proceed with navigation regardless
    }
    window.location.href = '/login'
}
