// JWT utilities for custom auth system

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-secret-key-change-in-production'
const JWT_ALGORITHM = 'HS256'

export interface JWTPayload {
    user_id: string
    username: string
    role: string
    is_active: string
    iat: number
    exp: number
}

// Simple base64url encoding
function base64UrlEncode(data: string): string {
    return btoa(data)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

// Simple base64url decoding
function base64UrlDecode(data: string): string {
    const padded = data.replace(/-/g, '+').replace(/_/g, '/').padEnd(data.length + (4 - data.length % 4) % 4, '=')
    return atob(padded)
}

// Simple HMAC-SHA256 signing — returns base64url-encoded signature (standard JWT)
async function signHMAC(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(data)

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

// Generate JWT token
export async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: number = 3600): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn,
    }

    const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALGORITHM, typ: 'JWT' }))
    const body = base64UrlEncode(JSON.stringify(fullPayload))
    const signature = await signHMAC(`${header}.${body}`, JWT_SECRET)

    return `${header}.${body}.${signature}`
}

// Verify JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const [header, body, signature] = token.split('.')
        if (!header || !body || !signature) return null

        const expectedSignature = await signHMAC(`${header}.${body}`, JWT_SECRET)
        if (signature !== expectedSignature) return null

        const payload: JWTPayload = JSON.parse(base64UrlDecode(body))
        const now = Math.floor(Date.now() / 1000)

        if (payload.exp < now) return null // Token expired

        return payload
    } catch {
        return null
    }
}
