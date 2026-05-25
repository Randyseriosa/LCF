import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyToken } from '../_shared/jwt.ts'

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
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse('Missing authorization header', 401)
        }

        const token = authHeader.replace('Bearer ', '')
        const jwtPayload = await verifyToken(token)

        if (!jwtPayload) return errorResponse('Unauthorized', 401)

        // Use service role client to fetch all profiles
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, name, avatar_url, role, is_active, created_at')
            .order('created_at', { ascending: true })

        if (profilesError) {
            console.error('Fetch profiles error:', profilesError)
            return errorResponse('Failed to fetch profiles', 500)
        }

        return new Response(JSON.stringify({ profiles }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
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
