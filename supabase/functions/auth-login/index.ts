/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateToken } from '../_shared/jwt.ts'

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

// Password hashing — salt is prepended when present (legacy records have no salt).
async function hashPassword(password: string, salt: string | null = null): Promise<string> {
    const encoder = new TextEncoder()
    const input = salt ? `${salt}:${password}` : password
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { username, password } = await req.json()
        console.log('Login attempt for username:', username)

        if (!username?.trim() || !password) {
            console.log('Missing username or password')
            return errorResponse('Username and password are required', 400)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Get auth_user by username
        const { data: authUser, error: authUserError } = await supabase
            .from('auth_users')
            .select('id, password_hash, password_salt')
            .eq('username', username.trim())
            .single()

        console.log('Auth user query result:', { authUser, authUserError })

        if (authUserError || !authUser) {
            console.log('Auth user not found')
            return errorResponse('Invalid username or password', 401)
        }

        // Verify password — use salt when present (salted accounts), else legacy plain hash
        const passwordHash = await hashPassword(password, authUser.password_salt ?? null)
        console.log('Password verification:', { hasSalt: !!authUser.password_salt, match: passwordHash === authUser.password_hash })

        if (passwordHash !== authUser.password_hash) {
            console.log('Password mismatch')
            return errorResponse('Invalid username or password', 401)
        }

        // Get profile to check status and role
        // Create profile if it doesn't exist (for seeded admin users)
        console.log('Looking up profile for auth_user_id:', authUser.id)
        let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, is_active')
            .eq('auth_user_id', authUser.id)
            .single()

        console.log('Profile query result:', { profile, profileError })

        if (profileError || !profile) {
            console.log('Profile not found, creating new profile')
            // Create profile with default admin role for first-time seeded users
            const profileId = crypto.randomUUID()
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: profileId,
                    auth_user_id: authUser.id,
                    username: username.trim(),
                    name: 'System Administrator',
                    role: 'admin',
                    is_active: 'active',
                })
                .select('role, is_active')
                .single()

            console.log('Profile creation result:', { newProfile, createError })

            if (createError || !newProfile) {
                console.log('Profile creation error:', createError)
                return errorResponse('Failed to create profile', 500)
            }
            profile = newProfile
        }

        if (profile.is_active !== 'active') {
            console.log('Account is inactive')
            return errorResponse('Account is inactive. Please contact your administrator.', 403)
        }

        console.log('Generating JWT tokens for user:', { user_id: authUser.id, role: profile.role, is_active: profile.is_active })

        // Generate JWT tokens
        const accessToken = await generateToken({
            user_id: authUser.id,
            username: username.trim(),
            role: profile.role,
            is_active: profile.is_active,
        }, 3600) // 1 hour

        console.log('Access token generated')

        const refreshToken = await generateToken({
            user_id: authUser.id,
            username: username.trim(),
            role: profile.role,
            is_active: profile.is_active,
        }, 86400 * 7) // 7 days

        console.log('Refresh token generated, sending response')

        return new Response(JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            user: {
                id: authUser.id,
                username: username.trim(),
                role: profile.role,
                is_active: profile.is_active,
            }
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
    } catch (err) {
        console.error('Unexpected error:', err)
        return errorResponse('Internal server error', 500)
    }
})
