'use client'

import { useEffect, useState } from 'react'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'
import { type Role, type UserStatus } from '@/lib/types/roles'

async function getToken(): Promise<string | null> {
    return getValidAccessToken()
}

export interface UserProfile {
    id: string
    username: string | null
    name: string | null
    avatar_url: string | null
    role: Role
    is_active: UserStatus
    created_at: string
}

export function useAllUsers() {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    async function fetchUsers() {
        setLoading(true)
        setError(null)

        const token = await getToken()
        if (!token) {
            setError('Not authenticated')
            setLoading(false)
            return
        }

        const currentUser = await getAuthUser()
        const currentUserId = currentUser?.id

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-users`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch users')
            }

            const { profiles } = await response.json()

            if (currentUserId) {
                setUsers(profiles.filter((u: UserProfile) => u.id !== currentUserId))
            } else {
                setUsers(profiles)
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch users'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    return { users, loading, error, refetch: fetchUsers }
}
