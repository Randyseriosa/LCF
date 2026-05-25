import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
}

// Password validation
function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
    return null
}

// Password hashing — salt is prepended before hashing.
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
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { username, password, name, role = 'viewer', is_active = 'inactive' } = await req.json()

        if (!username?.trim() || !password) {
            return errorResponse('Username and password are required', 400)
        }

        const pwError = validatePassword(password)
        if (pwError) return errorResponse(pwError, 400)

        const allowedRoles = ['admin', 'encoder', 'viewer']
        const allowedStatuses = ['active', 'inactive']
        if (!allowedRoles.includes(role)) return errorResponse(`Invalid role: ${role}`, 400)
        if (!allowedStatuses.includes(is_active)) return errorResponse(`Invalid status: ${is_active}`, 400)

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Check if username already exists
        const { data: existingUser } = await supabase
            .from('auth_users')
            .select('id')
            .eq('username', username.trim())
            .single()

        if (existingUser) {
            return errorResponse('Username already exists', 409)
        }

        // Hash the password with a fresh random salt
        const salt = generateSalt()
        const passwordHash = await hashPassword(password, salt)

        // Create auth_user
        const { data: authUser, error: authUserError } = await supabase
            .from('auth_users')
            .insert({
                username: username.trim(),
                password_hash: passwordHash,
                password_salt: salt,
            })
            .select('id')
            .single()

        if (authUserError || !authUser) {
            return errorResponse('Failed to create user', 500)
        }

        // Create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authUser.id,  // Use the same UUID
                auth_user_id: authUser.id,
                username: username.trim(),
                name: name || null,
                role,
                is_active,
            })

        if (profileError) {
            // Rollback auth_user creation
            await supabase.from('auth_users').delete().eq('id', authUser.id)
            return errorResponse('Failed to create profile', 500)
        }

        return new Response(JSON.stringify({ 
            success: true,
            user_id: authUser.id 
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
    } catch (err) {
        console.error('Unexpected error:', err)
        return errorResponse('Internal server error', 500)
    }
})
