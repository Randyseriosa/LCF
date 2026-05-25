'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle dark/light mode"
            className="flex w-full items-center gap-3 px-4 py-3 transition-colors text-sidebar-foreground hover:bg-primary/30 border border-transparent hover:border-primary/30"
        >
            <div className="relative w-10 h-5 flex-shrink-0">
                {/* Track - sharp corners */}
                <div
                    className={`absolute inset-0 transition-colors duration-300 ${isDark ? 'bg-accent/70' : 'bg-foreground-muted/30'
                        }`}
                />
                {/* Knob - sharp corners */}
                <div
                    className={`absolute top-0.5 w-4 h-4 bg-foreground shadow transition-all duration-300 flex items-center justify-center ${isDark ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                >
                    {isDark
                        ? <Moon className="w-2.5 h-2.5 text-background" />
                        : <Sun className="w-2.5 h-2.5 text-background" />
                    }
                </div>
            </div>
            <span className="font-semibold text-xs">
                {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
        </button>
    )
}
