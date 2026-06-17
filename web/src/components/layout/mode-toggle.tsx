'use client'

/**
 * ModeToggle — pílula Clássico ⇄ Assistente. FONTE ÚNICA, renderizada apenas
 * pela Sidebar global (components/layout/sidebar.tsx) — que serve os dois modos
 * na casca única. Como a casca é a mesma, o "contorno" do toggle é idêntico nos
 * dois modos por construção. Não duplicar a marcação em outro lugar.
 *
 * - `active`: modo atualmente ativo (sem transição).
 * - `switchingTo`: durante a navegação ótimista, qual lado já aparece ativo + spinner.
 */

import { LayoutGrid, Sparkles, Loader2 } from 'lucide-react'

interface Props {
    active: 'classic' | 'assistant'
    onClassic: () => void
    onAssistant: () => void
    switchingTo?: 'classic' | 'assistant'
}

const BTN = 'flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[7px] text-[12px] font-semibold transition-all duration-200'
const ON = 'bg-white dark:bg-glass-bg-active text-[#7C3AED] dark:text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
const OFF = 'text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground'

export function ModeToggle({ active, onClassic, onAssistant, switchingTo }: Props) {
    const eff = switchingTo ?? active
    return (
        <div className="mx-4 mb-3 flex gap-[3px] rounded-[11px] border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-glass-bg p-[3px]">
            <button onClick={onClassic} className={`${BTN} ${eff === 'classic' ? ON : OFF}`}>
                {switchingTo === 'classic'
                    ? <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    : <LayoutGrid size={14} strokeWidth={2} />} Clássico
            </button>
            <button onClick={onAssistant} className={`${BTN} ${eff === 'assistant' ? ON : OFF}`}>
                {switchingTo === 'assistant'
                    ? <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    : <Sparkles size={14} strokeWidth={2} />} Assistente
            </button>
        </div>
    )
}
