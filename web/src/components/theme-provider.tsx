'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentType, ReactNode } from 'react'

const LOGGED_AREA_PREFIXES = ['/dashboard', '/students', '/programs', '/exercises', '/settings']

function isLoggedArea(pathname: string): boolean {
    return LOGGED_AREA_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

type AppThemeProviderProps = {
    children: ReactNode
}

export function ThemeProvider({ children }: AppThemeProviderProps) {
    const pathname = usePathname()
    const forceDark = !isLoggedArea(pathname)
    const Provider = NextThemesProvider as ComponentType<any>

    return (
        <Provider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            storageKey="kinevo-theme"
            forcedTheme={forceDark ? 'dark' : undefined}
        >
            {children}
        </Provider>
    )
}
