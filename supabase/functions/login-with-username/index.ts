/// <reference path="../deno.d.ts" />
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

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { username, password } = await req.json()

        if (!username?.trim() || !password) {
            return errorResponse('Username and password are required', 400)
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Resolve profile by username to get the internal user id
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('username', username.trim())
            .single()

        if (profileError || !profile) {
            return errorResponse('Invalid username or password', 401)
        }

        // Retrieve auth user to get the email stored in auth.users
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id)

        if (userError || !user?.email) {
            return errorResponse('Invalid username or password', 401)
        }

        // Sign in via anon client so that proper session tokens are issued
        const supabaseAnon = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!
        )

        const { data, error: signInError } = await supabaseAnon.auth.signInWithPassword({
            email: user.email,
            password,
        })

        if (signInError || !data.session) {
            return errorResponse('Invalid username or password', 401)
        }

        return new Response(JSON.stringify({ session: data.session }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
    } catch (err) {
        console.error('Unexpected error:', err)
        return errorResponse('Internal server error', 500)
    }
})
