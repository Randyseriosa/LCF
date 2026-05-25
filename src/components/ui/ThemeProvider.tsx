'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
    theme: Theme
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => { },
})

export function useTheme() {
    return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light')

    // On mount: read persisted preference or system preference
    useEffect(() => {
        const stored = localStorage.getItem('theme') as Theme | null
        if (stored === 'dark' || stored === 'light') {
            setTheme(stored)
            applyTheme(stored)
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            const resolved: Theme = prefersDark ? 'dark' : 'light'
            setTheme(resolved)
            applyTheme(resolved)
        }
    }, [])

    function applyTheme(t: Theme) {
        const html = document.documentElement
        if (t === 'dark') {
            html.classList.add('dark')
            html.classList.remove('light')
        } else {
            html.classList.add('light')
            html.classList.remove('dark')
        }
    }

    function toggleTheme() {
        setTheme(prev => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark'
            localStorage.setItem('theme', next)
            applyTheme(next)
            return next
        })
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
