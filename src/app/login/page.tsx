'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
export default function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async () => {
        setError(null)

        if (!username.trim() || !password.trim()) {
            setError('Username and password are required.')
            return
        }

        setLoading(true)

        try {
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth-login`
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            })

            const data = await res.json()

            if (!res.ok || !data.access_token) {
                setError(data.error ?? 'Invalid username or password.')
                setLoading(false)
                return
            }

            const sessionRes = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                }),
            })

            window.location.href = data.user.is_active === 'active' ? `/${data.user.role}` : '/inactive'
        } catch (err) {
            setError('Failed to login. Please try again.')
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin()
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-background p-4">
            {/* Structural Grid Lines */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                opacity: 0.05
            }} />

            <div className="relative w-full max-w-sm">
                {/* Top accent bar */}
                <div className="h-1 w-full bg-accent" />

                <div className="bg-surface border border-primary/20 p-4 shadow-popover">
                    {/* Header */}
                    <div className="mb-4">
                        <div className="flex flex-col items-center gap-4 mb-5 pt-2 text-center">
                            <img
                                src="/images/logo/logo.png"
                                alt="LCFPF Logo"
                                className="w-[72px] h-[72px] object-contain"
                            />
                            <div>
                                <h1 className="text-2xl font-black text-foreground tracking-tight">LCF</h1>
                                <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em] mt-1">Inventory System</p>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-5 px-4 py-3 bg-error-bg border border-error/30 text-error text-xs font-semibold">
                            {error}
                        </div>
                    )}

                    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-foreground-muted mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter your username"
                                    disabled={loading}
                                    className="w-full pl-9 pr-4 py-3 text-sm border border-primary/20 bg-background text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-colors disabled:opacity-50 font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-foreground-muted mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter your password"
                                    disabled={loading}
                                    className="w-full pl-9 pr-10 py-3 text-sm border border-primary/20 bg-background text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-colors disabled:opacity-50 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-accent border border-accent/60 text-white font-bold text-xs py-3 px-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                        >
                            {loading && (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" />
                            )}
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-[10px] font-medium text-foreground-muted mt-4">
                        Contact administrator for access
                    </p>
                </div>

                {/* Bottom accent line */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            </div>
        </main>
    )
}
