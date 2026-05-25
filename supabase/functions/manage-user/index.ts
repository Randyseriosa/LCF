import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

const ALLOWED_ROLES = ['admin', 'encoder', 'viewer'] as const
const ALLOWED_STATUSES = ['active', 'inactive'] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]
type AllowedStatus = (typeof ALLOWED_STATUSES)[number]

interface CreatePayload {
    action: 'create'
    username: string
    password: string
    name?: string
    role?: AllowedRole
    is_active?: AllowedStatus
}

interface DeletePayload {
    action: 'delete'
    target_user_id: string
}

interface ResetPasswordPayload {
    action: 'reset_password'
    target_user_id: string
    new_password: string
}

type Payload = CreatePayload | DeletePayload | ResetPasswordPayload

function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
    return null
}

async function hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${password}`))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateSalt(): string {
    return crypto.randomUUID()
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) return errorResponse('Missing authorization header', 401)

        const token = authHeader.replace('Bearer ', '')
        const payload = await verifyToken(token)

        if (!payload) return errorResponse('Unauthorized', 401)
        if (payload.role !== 'admin' || payload.is_active !== 'active') {
            return errorResponse('Forbidden: Active admin role required', 403)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const body: Payload = await req.json()

        if (body.action === 'create') {
            const { username, password, name, role = 'viewer', is_active = 'inactive' } = body

            if (!username || !password) return errorResponse('username and password are required', 400)

            const pwError = validatePassword(password)
            if (pwError) return errorResponse(pwError, 400)

            if (!ALLOWED_ROLES.includes(role)) return errorResponse(`Invalid role: ${role}`, 400)
            if (!ALLOWED_STATUSES.includes(is_active)) return errorResponse(`Invalid status: ${is_active}`, 400)

            // Check if username already exists
            const { data: existingUser } = await supabase
                .from('auth_users')
                .select('id')
                .eq('username', username.trim())
                .single()

            if (existingUser) {
                return errorResponse('Username already exists', 409)
            }

            const salt = generateSalt()
            const passwordHash = await hashPassword(password, salt)

            // Create auth_user and profile in a transaction-like operation
            const userId = crypto.randomUUID()

            const { error: authUserError } = await supabase
                .from('auth_users')
                .insert({
                    id: userId,
                    username: username.trim(),
                    password_hash: passwordHash,
                    password_salt: salt,
                })

            if (authUserError) return errorResponse('Failed to create user', 500)

            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    auth_user_id: userId,
                    username: username.trim(),
                    name: name || null,
                    role,
                    is_active,
                })

            if (profileError) {
                // Rollback
                await supabase.from('auth_users').delete().eq('id', userId)
                return errorResponse('User created but profile creation failed', 500)
            }

            return successResponse({ user_id: userId })
        }

        if (body.action === 'delete') {
            const { target_user_id } = body
            if (!target_user_id) return errorResponse('target_user_id is required', 400)

            // Prevent admin from deleting themselves
            if (target_user_id === payload.user_id) return errorResponse('Cannot delete your own account', 400)

            // Delete profile first (cascades to auth_users via foreign key)
            const { error: deleteError } = await supabase
                .from('profiles')
                .delete()
                .eq('auth_user_id', target_user_id)

            if (deleteError) return errorResponse(deleteError.message, 400)

            return successResponse({ deleted: true })
        }

        if (body.action === 'reset_password') {
            const { target_user_id, new_password } = body
            if (!target_user_id || !new_password) return errorResponse('target_user_id and new_password are required', 400)

            const pwError = validatePassword(new_password)
            if (pwError) return errorResponse(pwError, 400)

            const newSalt = generateSalt()
            const passwordHash = await hashPassword(new_password, newSalt)

            const { error: updateError } = await supabase
                .from('auth_users')
                .update({ password_hash: passwordHash, password_salt: newSalt })
                .eq('id', target_user_id)

            if (updateError) return errorResponse(updateError.message, 400)

            return successResponse({ reset: true })
        }

        return errorResponse('Invalid action', 400)
    } catch (err) {
        console.error('Unexpected error:', err)
        return errorResponse('Internal server error', 500)
    }
})

function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
}

function successResponse(data: Record<string, unknown>) {
    return new Response(JSON.stringify({ success: true, ...data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
}
