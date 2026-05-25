import { cookies } from 'next/headers'

export interface AuthUser {
    id: string
    username: string
    role: string
    is_active: string
}

// Server-side JWT verification
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

// Get auth user from JWT (server-side)
export async function getAuthUserServer(): Promise<AuthUser | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value

    if (!token) return null

    const payload = await verifyJWTToken(token)
    if (!payload) return null

    return {
        id: payload.user_id,
        username: payload.username,
        role: payload.role,
        is_active: payload.is_active,
    }
}
