'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentType, ReactNode } from 'react'

const LOGGED_AREA_PREFIXES = ['/dashboard', '/students', '/programs', '/exercises', '/schedule', '/settings', '/forms', '/avaliacoes', '/financial', '/training-room', '/marketing', '/leads', '/landing', '/assistente']
const FORCE_LIGHT_ROUTES = ['/', '/login', '/signup']
// /assistente saiu daqui em 07/jul/2026: a casca (workspace/sidebar/meter) ganhou
// pares dark: e segue a preferência do treinador como o resto da área logada.
const FORCE_LIGHT_PREFIXES = ['/auth']
const FORCE_DARK_ROUTES = ['/terms', '/privacy', '/subscription']

function getThemeForRoute(pathname: string): 'light' | 'dark' | undefined {
    if (FORCE_LIGHT_ROUTES.includes(pathname)) return 'light'
    if (FORCE_LIGHT_PREFIXES.some((r) => pathname.startsWith(r))) return 'light'
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
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
            storageKey="kinevo-theme"
            forcedTheme={forcedTheme}
        >
            {children}
        </Provider>
    )
}
