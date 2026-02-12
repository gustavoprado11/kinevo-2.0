'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentType, ReactNode } from 'react'

const LOGGED_AREA_PREFIXES = ['/dashboard', '/students', '/programs', '/exercises', '/settings']
const FORCE_LIGHT_ROUTES = ['/', '/login', '/signup']
const FORCE_DARK_ROUTES = ['/terms', '/privacy', '/subscription']

function getThemeForRoute(pathname: string): 'light' | 'dark' | undefined {
    if (FORCE_LIGHT_ROUTES.includes(pathname)) return 'light'
    if (FORCE_DARK_ROUTES.some((r) => pathname.startsWith(r))) return 'dark'
    if (LOGGED_AREA_PREFIXES.some((r) => pathname.startsWith(r))) return undefined
    return 'dark'
}

type AppThemeProviderProps = {
    children: ReactNode
}

export function ThemeProvider({ children }: AppThemeProviderProps) {
    const pathname = usePathname()
    const forcedTheme = getThemeForRoute(pathname)
    const Provider = NextThemesProvider as ComponentType<any>

    return (
        <Provider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            storageKey="kinevo-theme"
            forcedTheme={forcedTheme}
        >
            {children}
        </Provider>
    )
}
