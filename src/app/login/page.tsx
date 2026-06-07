'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react'

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
        <main className="min-h-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden">

            {/* ── LEFT COLUMN: Deep Navy with texture ── */}
            <div
                className="hidden md:flex flex-col items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: '#000080' }}
            >
                {/* Topographic / geometric SVG texture overlay */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `
                            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 60%),
                            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 50%),
                            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
                            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                        `,
                        backgroundSize: '100% 100%, 100% 100%, 80px 80px, 80px 80px, 16px 16px, 16px 16px',
                    }}
                />
                {/* Radar System Container */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">

                    {/* The Radar Base Grid */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {/* Concentric Circles - many more to fill screen */}
                        {[200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000].map((size, i) => (
                            <div
                                key={size}
                                className="absolute border border-white/5 rounded-full"
                                style={{
                                    width: size,
                                    height: size,
                                }}
                            />
                        ))}

                        {/* Crosshairs - extended to fill screen */}
                        <div className="absolute w-[2000px] h-[1px] bg-white/5" />
                        <div className="absolute h-[2000px] w-[1px] bg-white/5" />

                        {/* Diagonal Crosshairs */}
                        <div className="absolute w-[2000px] h-[1px] bg-white/5 rotate-45" />
                        <div className="absolute w-[2000px] h-[1px] bg-white/5 -rotate-45" />

                        {/* Distance Markers (Small Ticks) */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            {[100, 200, 300, 400, 500, 600, 700, 800].map((dist) => (
                                <div key={dist} className="absolute text-[8px] font-mono text-white/20" style={{ transform: `translateY(-${dist}px)` }}>
                                    {dist / 2}KM
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* The Scanner Sweep (Angular Gradient) - Full Coverage */}
                    <div className="absolute flex items-center justify-center pointer-events-none animate-sweep"
                        style={{ width: 2200, height: 2200 }}>
                        <div
                            className="w-full h-full rounded-full"
                            style={{
                                background: 'conic-gradient(from 0deg, rgba(255,255,255,0.4) 0deg, rgba(255,255,255,0.05) 20deg, transparent 120deg, transparent 360deg)',
                                mask: 'radial-gradient(circle, black 20%, transparent 80%)',
                                WebkitMask: 'radial-gradient(circle, black 20%, transparent 80%)'
                            }}
                        />
                        {/* Leading Edge Line */}
                        <div className="absolute top-0 left-1/2 w-[1.5px] h-1/2 bg-white/30 origin-bottom"
                            style={{ transform: 'translateX(-50%)' }} />
                    </div>

                    {/* Blips (Random tactical points scattered across larger area) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden" style={{ opacity: 0.6 }}>
                        <div className="absolute w-2 h-2 bg-white/60 rounded-full -translate-x-48 -translate-y-64 blur-[2px] animate-pulse" />
                        <div className="absolute w-1.5 h-1.5 bg-white/40 rounded-full translate-x-80 -translate-y-20 blur-[1px] animate-pulse" style={{ animationDelay: '1s' }} />
                        <div className="absolute w-2 h-2 bg-white/50 rounded-full -translate-x-20 translate-y-96 blur-[1.5px] animate-pulse" style={{ animationDelay: '2s' }} />
                        <div className="absolute w-1.5 h-1.5 bg-white/30 rounded-full translate-x-[400px] translate-y-[-300px] blur-[1px] animate-pulse" style={{ animationDelay: '1.5s' }} />
                        <div className="absolute w-2 h-2 bg-white/40 rounded-full translate-x-[-350px] translate-y-[200px] blur-[1px] animate-pulse" style={{ animationDelay: '0.5s' }} />
                    </div>

                    {/* Emblem — perfectly centered */}
                    <div className="relative z-20 flex flex-col items-center justify-center">
                        <img
                            src="/images/logo/logo-login.png"
                            alt="LCFPF Global Logo"
                            className="w-full max-w-xs h-auto object-contain animate-breathe"
                            style={{
                                filter: 'drop-shadow(0 4px 32px rgba(0,0,0,0.5))',
                            }}
                        />

                        {/* Tactical HUD Overlay for the logo */}
                        <div className="absolute -inset-8 border-[1px] border-white/10 pointer-events-none">
                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/40" />
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/40" />
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/40" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/40" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RIGHT COLUMN: Clean off-white, seamless split ── */}
            <div
                className="flex flex-col items-center justify-center min-h-screen px-8 md:px-14 lg:px-20 relative"
                style={{ backgroundColor: '#F4F6F9' }}
            >
                {/* Subtle background pattern on the right as well */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(0,0,128,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,128,0.025) 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />

                <div className="relative z-10 w-full max-w-sm">
                    {/* Header */}
                    <div className="mb-10 text-center flex flex-col items-center">
                        <h1
                            className="font-black text-foreground"
                            style={{ fontSize: '2.75rem', lineHeight: 1, letterSpacing: '-0.02em', color: '#000033' }}
                        >
                            LCF WCEIS
                        </h1>
                        <p
                            className="font-semibold uppercase mt-4 text-center"
                            style={{
                                fontSize: '0.65rem',
                                letterSpacing: '0.35em',
                                color: '#000080',
                                lineHeight: '1.6',
                            }}
                        >
                            Equipment Monitoring<br />
                            and Management System
                        </p>
                        {/* Accent rule */}
                        <div className="mt-4" style={{ width: 40, height: 3, backgroundColor: '#000080' }} />
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            className="mb-6 px-4 py-3 text-xs font-bold uppercase tracking-wider"
                            style={{
                                backgroundColor: '#FEE2E2',
                                border: '1px solid #DC2626',
                                color: '#DC2626',
                            }}
                        >
                            [ Error ]: {error}
                        </div>
                    )}

                    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-5">

                        {/* Username */}
                        <div>
                            <label
                                className="block font-bold mb-2 uppercase"
                                style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: '#5a6384' }}
                            >
                                Operator ID / Username
                            </label>
                            <div className="relative group">
                                <User
                                    size={14}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: '#9ba3bf' }}
                                />
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter operator username"
                                    disabled={loading}
                                    className="w-full pl-10 pr-4 text-sm font-mono tracking-tight transition-all disabled:opacity-50"
                                    style={{
                                        height: '52px',
                                        border: '1px solid rgba(0,0,128,0.18)',
                                        backgroundColor: '#FFFFFF',
                                        color: '#000033',
                                        outline: 'none',
                                        borderRadius: '4px',
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = '#000080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,0,128,0.12)'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,128,0.18)'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                className="block font-bold mb-2 uppercase"
                                style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: '#5a6384' }}
                            >
                                Access Key / Password
                            </label>
                            <div className="relative group">
                                <Lock
                                    size={14}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: '#9ba3bf' }}
                                />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter access key"
                                    disabled={loading}
                                    className="w-full pl-10 pr-11 text-sm font-mono tracking-tight transition-all disabled:opacity-50"
                                    style={{
                                        height: '52px',
                                        border: '1px solid rgba(0,0,128,0.18)',
                                        backgroundColor: '#FFFFFF',
                                        color: '#000033',
                                        outline: 'none',
                                        borderRadius: '4px',
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = '#000080'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,0,128,0.12)'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,128,0.18)'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: '#9ba3bf' }}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 font-bold uppercase transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-6"
                            style={{
                                height: '52px',
                                backgroundColor: '#000080',
                                color: '#FFFFFF',
                                fontSize: '0.7rem',
                                letterSpacing: '0.2em',
                                borderRadius: '4px',
                                fontWeight: 700,
                                border: 'none',
                            }}
                            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#0000aa'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#000080'; }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    <span>Authorizing...</span>
                                </>
                            ) : (
                                <span>Sign In</span>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p
                        className="mt-8 text-center uppercase"
                        style={{ fontSize: '0.55rem', letterSpacing: '0.15em', color: '#9ba3bf' }}
                    >
                        Authorized Personnel Only
                    </p>
                </div>
            </div>
        </main>
    )
}
