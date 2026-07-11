'use client'

import { useState } from 'react'
import { useAllUsers, type UserProfile } from '@/features/admin/hooks/useAllUsers'
import { updateUserProfile, createUser } from '@/services/userProfileService'
import { ROLES, USER_STATUS, type Role, type UserStatus } from '@/lib/types/roles'
import { UserCog, ChevronDown, Loader2, CheckCircle, XCircle, RefreshCw, Plus, X } from 'lucide-react'

type ToastType = 'success' | 'error'
interface Toast { message: string; type: ToastType }

export default function AdminUsersPage() {
    const { users, loading, error, refetch } = useAllUsers()
    const [updating, setUpdating] = useState<string | null>(null)
    const [toast, setToast] = useState<Toast | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [modalError, setModalError] = useState<string | null>(null)

    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        name: '',
        role: 'viewer' as Role,
        is_active: 'inactive' as UserStatus
    })

    function showToast(message: string, type: ToastType) {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3500)
    }

    async function handleCreateUser() {
        if (!newUser.username || !newUser.password) {
            setModalError('Username and password are required')
            return
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
        if (!passwordRegex.test(newUser.password)) {
            setModalError('Password must be at least 8 characters with uppercase, lowercase, and a number')
            return
        }

        setCreating(true)
        setModalError(null)
        try {
            await createUser({
                username: newUser.username,
                password: newUser.password,
                name: newUser.name || undefined,
                role: newUser.role,
                isActive: newUser.is_active,
            })
            showToast(`User "${newUser.username}" created successfully`, 'success')
            setShowCreateModal(false)
            setNewUser({ username: '', password: '', name: '', role: 'viewer', is_active: 'inactive' })
            setModalError(null)
            await refetch()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error'
            setModalError(msg)
        } finally {
            setCreating(false)
        }
    }

    async function handleRoleChange(user: UserProfile, newRole: Role) {
        if (newRole === user.role) return
        setUpdating(user.id + '-role')
        try {
            await updateUserProfile({ targetUserId: user.id, role: newRole })
            showToast(`Role updated to "${newRole}" for ${user.name ?? user.username}`, 'success')
            await refetch()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error'
            showToast(`Failed to update role: ${msg}`, 'error')
        } finally {
            setUpdating(null)
        }
    }

    async function handleStatusToggle(user: UserProfile) {
        const newStatus: UserStatus = user.is_active === USER_STATUS.active
            ? USER_STATUS.inactive
            : USER_STATUS.active
        setUpdating(user.id + '-status')
        try {
            await updateUserProfile({ targetUserId: user.id, isActive: newStatus })
            showToast(
                `User "${user.name ?? user.username}" is now ${newStatus}`,
                'success'
            )
            await refetch()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error'
            showToast(`Failed to update status: ${msg}`, 'error')
        } finally {
            setUpdating(null)
        }
    }

    const roleColors: Record<Role, string> = {
        admin: 'bg-primary/20 text-primary',
        encoder: 'bg-green-500/20 text-green-400',
        viewer: 'bg-gray-500/20 text-gray-400',
    }

    return (
        <div className="p-4 space-y-3">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-semibold text-foreground flex items-center gap-3">
                        <UserCog className="w-6 h-6 text-accent" />
                        User Management
                    </h1>
                    <p className="text-foreground-muted mt-1 text-sm">
                        Manage roles and activation status for all system users.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setModalError(null)
                            setShowCreateModal(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-secondary-hover text-white transition-colors text-xs font-bold shadow-card border border-accent/50"
                    >
                        <Plus className="w-4 h-4" />
                        Create User
                    </button>
                    <button
                        onClick={refetch}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2  bg-surface border border-foreground/10 text-foreground hover:bg-foreground/5 transition-colors text-sm font-medium disabled:opacity-50 shadow-card"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div
                    className={`flex items-center gap-3 px-5 py-4 text-sm font-medium shadow-popover border transition-all animate-in fade-in slide-in-from-top-2 ${toast.type === 'success'
                        ? 'bg-success-bg border-success/30 text-success'
                        : 'bg-error-bg border-error/30 text-error'
                        }`}
                >
                    {toast.type === 'success'
                        ? <CheckCircle className="w-5 h-5" />
                        : <XCircle className="w-5 h-5" />
                    }
                    {toast.message}
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="bg-error-bg border border-error/30 text-error px-5 py-4 text-sm">
                    {error}
                </div>
            )}

            {/* Table Card */}
            <div className=" bg-surface border border-foreground/10 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-foreground/10 bg-foreground/2">
                                <th className="text-left px-4 py-4 font-semibold text-foreground-muted text-xs">
                                    User
                                </th>
                                <th className="text-left px-4 py-4 font-semibold text-foreground-muted text-xs">
                                    Username
                                </th>
                                <th className="text-left px-4 py-4 font-semibold text-foreground-muted text-xs">
                                    Role
                                </th>
                                <th className="text-left px-4 py-4 font-semibold text-foreground-muted text-xs">
                                    Status
                                </th>
                                <th className="text-left px-4 py-4 font-semibold text-foreground-muted text-xs">
                                    Joined
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-3 text-foreground-muted">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Loading users...
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-center text-foreground-muted">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                            {!loading && users.map((user) => (
                                <tr key={user.id} className="hover:bg-foreground/2 transition-colors">
                                    {/* Avatar + Name */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                                                {user.avatar_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.name ?? ''}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-primary font-semibold text-sm">
                                                        {(user.name ?? user.username ?? '?')[0].toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-medium text-foreground">
                                                {user.name ?? '—'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Username */}
                                    <td className="px-4 py-2 text-foreground-muted whitespace-nowrap">
                                        {user.username ?? '—'}
                                    </td>

                                    {/* Role Select */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {updating === user.id + '-role' ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : (
                                            <div className="relative inline-flex items-center">
                                                <span className={`absolute left-2 w-2 h-2 ${user.role === ROLES.admin ? 'bg-primary' :
                                                    user.role === ROLES.encoder ? 'bg-green-400' : 'bg-gray-400'
                                                    }`} />
                                                <select
                                                    id={`role-select-${user.id}`}
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                                                    className={`pl-5 pr-7 py-1.5 text-xs font-medium border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 ${roleColors[user.role]}`}
                                                >
                                                    {Object.values(ROLES).map((r) => (
                                                        <option key={r} value={r} className="bg-surface text-foreground capitalize">
                                                            {r}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-1.5 w-3 h-3 pointer-events-none" />
                                            </div>
                                        )}
                                    </td>

                                    {/* Status Toggle */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {updating === user.id + '-status' ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : (
                                            <button
                                                id={`status-toggle-${user.id}`}
                                                onClick={() => handleStatusToggle(user)}
                                                className={`relative inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 ${user.is_active === USER_STATUS.active
                                                    ? 'bg-success-bg text-success hover:bg-success-bg'
                                                    : 'bg-foreground/5 text-foreground-muted hover:bg-foreground/10'
                                                    }`}
                                            >
                                                <span className={`w-1.5 h-1.5 ${user.is_active === USER_STATUS.active ? 'bg-success' : 'bg-foreground-muted'
                                                    }`} />
                                                {user.is_active === USER_STATUS.active ? 'Active' : 'Inactive'}
                                            </button>
                                        )}
                                    </td>

                                    {/* Joined */}
                                    <td className="px-4 py-2 text-foreground-muted text-xs whitespace-nowrap">
                                        {new Date(user.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer count */}
                {!loading && users.length > 0 && (
                    <div className="px-4 py-3 border-t border-foreground/5 text-xs text-foreground-muted">
                        {users.length} user{users.length !== 1 ? 's' : ''} total
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface shadow-popover border border-foreground/10 w-full max-w-md">
                        <div className="flex items-center justify-between px-4 py-5 border-b border-foreground/10">
                            <h2 className="text-lg font-semibold text-foreground">Create New User</h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false)
                                    setModalError(null)
                                }}
                                className="text-foreground-muted hover:text-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-4">
                            {modalError && (
                                <div className="text-sm text-error bg-error-bg p-3 border border-error/30 flex items-center gap-2 font-medium">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Username</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    placeholder="jdelacruz"
                                    className="w-full px-4 py-3 text-sm border border-primary/30 bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Min 8 chars, uppercase, lowercase, number"
                                    className="w-full px-4 py-3 text-sm border border-primary/30 bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Name (optional)</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="Juan dela Cruz"
                                    className="w-full px-4 py-3 text-sm border border-primary/30 bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                                    className="w-full px-4 py-3 text-sm border border-primary/30 bg-background text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all appearance-none cursor-pointer"
                                >
                                    {Object.values(ROLES).map((r) => (
                                        <option key={r} value={r} className="bg-surface text-foreground capitalize">
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
                                <select
                                    value={newUser.is_active}
                                    onChange={(e) => setNewUser({ ...newUser, is_active: e.target.value as UserStatus })}
                                    className="w-full px-4 py-3 text-sm border border-primary/30 bg-background text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all appearance-none cursor-pointer"
                                >
                                    {Object.values(USER_STATUS).map((s) => (
                                        <option key={s} value={s} className="bg-surface text-foreground capitalize">
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-4 border-t border-foreground/10">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false)
                                    setModalError(null)
                                }}
                                disabled={creating}
                                className="flex-1 px-4 py-2.5 border border-foreground/10 text-foreground hover:bg-foreground/5 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateUser}
                                disabled={creating}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-secondary-hover text-white transition-colors text-xs font-bold disabled:opacity-50"
                            >
                                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                Create User
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
