'use client'

/**
 * IntentInput — linha de entrada da barra de comando ⌘K (Trilha 1).
 *
 * Espelha o `.pin` do mock `ai-trainer-mock-commandbar.html`: ícone de IA
 * (gradiente violeta), campo livre e o selo de modo "Agir". É só apresentação +
 * eventos; o estado vive no CommandBar.
 */

import { forwardRef } from 'react'
import { Sparkles, Zap, Loader2 } from 'lucide-react'

interface IntentInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    loading?: boolean
    disabled?: boolean
    placeholder?: string
}

export const IntentInput = forwardRef<HTMLInputElement, IntentInputProps>(
    function IntentInput(
        { value, onChange, onSubmit, loading = false, disabled = false, placeholder },
        ref,
    ) {
        return (
            <div className="flex items-center gap-3 border-b border-[#E8E8ED] dark:border-k-border-subtle px-[18px] py-[15px]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white">
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                    ) : (
                        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                    )}
                </span>
                <input
                    ref={ref}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            onSubmit()
                        }
                    }}
                    disabled={disabled}
                    placeholder={placeholder ?? 'Diga o que fazer nesta tela…'}
                    className="flex-1 border-0 bg-transparent text-[16.5px] text-[#1D1D1F] dark:text-foreground outline-none placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/60 disabled:opacity-60"
                    autoFocus
                    aria-label="Comando para a IA"
                />
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#DDD2FB] dark:border-violet-500/30 bg-[#F4F1FE] dark:bg-violet-500/10 px-2.5 py-1 text-[11.5px] font-bold text-[#7C3AED] dark:text-violet-400">
                    <Zap className="h-3 w-3" strokeWidth={2.5} />
                    Agir
                </span>
            </div>
        )
    },
)
