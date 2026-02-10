'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { updateTheme, type ThemePreference } from '@/actions/trainer/update-theme'

interface ThemeSelectorProps {
    initialTheme?: ThemePreference | null
}

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: ReactNode }> = [
    { value: 'light', label: 'Claro', icon: <Sun size={16} /> },
    { value: 'dark', label: 'Escuro', icon: <Moon size={16} /> },
    { value: 'system', label: 'Sistema', icon: <Monitor size={16} /> },
]

export function ThemeSelector({ initialTheme = 'system' }: ThemeSelectorProps) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return
        if (!initialTheme) return
        if (theme === initialTheme) return
        setTheme(initialTheme)
    }, [mounted, initialTheme, theme, setTheme])

    const selectedTheme = useMemo<ThemePreference>(() => {
        if (!theme || (theme !== 'light' && theme !== 'dark' && theme !== 'system')) {
            return 'system'
        }
        return theme
    }, [theme])

    const handleSelect = (nextTheme: ThemePreference) => {
        setError(null)
        setTheme(nextTheme)

        startTransition(async () => {
            const result = await updateTheme(nextTheme)
            if (!result.success) {
                setError(result.message || 'Não foi possível salvar sua preferência.')
            }
        })
    }

    return (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_10px_26px_rgba(2,6,23,0.18)]">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">Aparência</h2>
                <p className="text-sm text-muted-foreground mt-1">Escolha como o sistema será exibido.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {OPTIONS.map((option) => {
                    const active = mounted && selectedTheme === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            disabled={isPending}
                            className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                active
                                    ? 'border-violet-500/50 bg-violet-500/15 text-foreground'
                                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                            } ${isPending ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {option.icon}
                            {option.label}
                        </button>
                    )
                })}
            </div>

            <p className="text-xs text-muted-foreground mt-3">
                {isPending ? 'Salvando preferência...' : 'Sua escolha é salva no navegador e na sua conta.'}
            </p>

            {error && (
                <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                    {error}
                </div>
            )}
        </div>
    )
}
