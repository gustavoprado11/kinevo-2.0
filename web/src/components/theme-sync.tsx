'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeSyncProps {
    trainerTheme?: ThemePreference | null
}

export function ThemeSync({ trainerTheme }: ThemeSyncProps) {
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        if (!trainerTheme) return
        if (theme === trainerTheme) return
        setTheme(trainerTheme)
    }, [trainerTheme, theme, setTheme])

    return null
}
