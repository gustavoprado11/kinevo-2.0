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

import { LayoutGrid, Loader2 } from 'lucide-react'
import { AssistantMark } from '@/components/assistant/assistant-mark'

interface Props {
    active: 'classic' | 'assistant'
    onClassic: () => void
    onAssistant: () => void
    switchingTo?: 'classic' | 'assistant'
}

const BTN = 'flex flex-1 items-center justify-center gap-1.5 rounded-[6px] py-[7px] text-[12px] font-semibold transition-all duration-200'
const ON = 'bg-surface-card text-k-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
const OFF = 'text-k-text-secondary hover:text-k-text-primary'

export function ModeToggle({ active, onClassic, onAssistant, switchingTo }: Props) {
    const eff = switchingTo ?? active
    return (
        <div className="mx-4 mb-3 flex gap-[3px] rounded-control border border-k-border-subtle bg-surface-inset p-[3px]">
            <button onClick={onClassic} className={`${BTN} ${eff === 'classic' ? ON : OFF}`}>
                {switchingTo === 'classic'
                    ? <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    : <LayoutGrid size={14} strokeWidth={2} />} Clássico
            </button>
            <button onClick={onAssistant} className={`${BTN} ${eff === 'assistant' ? ON : OFF}`}>
                {switchingTo === 'assistant'
                    ? <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    : <AssistantMark size={14} strokeWidth={2} />} Assistente
            </button>
        </div>
    )
}
