import { getAuthUser } from '@/lib/auth'
import type { Role, UserStatus } from '@/lib/types/roles'

function getToken(): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
}

async function callEdgeFunction(fnName: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = getToken()
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Operation failed')
    return data
}

interface UpdateUserProfileParams {
    targetUserId: string
    role?: Role
    isActive?: UserStatus
}

export async function updateUserProfile({ targetUserId, role, isActive }: UpdateUserProfileParams) {
    const user = await getAuthUser()
    if (!user) throw new Error('Not authenticated')

    return callEdgeFunction('update-user-profile', {
        target_user_id: targetUserId,
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { is_active: isActive }),
    })
}

interface CreateUserParams {
    username: string
    password: string
    name?: string
    role: Role
    isActive: UserStatus
}

export async function createUser({ username, password, name, role, isActive }: CreateUserParams) {
    const user = await getAuthUser()
    if (!user) throw new Error('Not authenticated')

    return callEdgeFunction('manage-user', {
        action: 'create',
        username: username.trim(),
        password,
        name: name?.trim() || null,
        role,
        is_active: isActive,
    })
}
