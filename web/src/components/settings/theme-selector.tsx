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
        <div className="bg-surface-card border border-k-border-primary rounded-2xl p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-k-text-primary">Aparência</h2>
                    <p className="text-sm text-k-text-tertiary mt-1">Escolha como o sistema será exibido.</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    {selectedTheme === 'light' ? <Sun size={18} strokeWidth={1.5} /> :
                        selectedTheme === 'dark' ? <Moon size={18} strokeWidth={1.5} /> :
                            <Monitor size={18} strokeWidth={1.5} />}
                </div>
            </div>

            <div className="bg-surface-inset p-1 rounded-xl border border-k-border-subtle flex gap-1">
                {OPTIONS.map((option) => {
                    const active = mounted && selectedTheme === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            disabled={isPending}
                            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${active
                                ? 'bg-glass-bg-active text-k-text-primary shadow-sm border border-k-border-primary backdrop-blur-md'
                                : 'text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg border border-transparent'
                                } ${isPending ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {option.icon}
                            {option.label}
                        </button>
                    )
                })}
            </div>

            <p className="text-[10px] uppercase tracking-widest font-bold text-k-text-quaternary mt-4">
                {isPending ? 'Salvando preferência...' : 'Sua escolha é salva no navegador e na sua conta.'}
            </p>

            {error && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
                    {error}
                </div>
            )}
        </div>
    )
}
