'use client'

/**
 * AssistantLauncher — bolha flutuante que ABRE O DOCK do Assistente (não navega).
 *
 * Bolha global (canto inferior direito), para tiers com Assistente. Abre o mesmo painel
 * ancorado à direita (communication-store) — sem trocar o homeStyle. Some na
 * home do Assistente (/assistente, que já é o chat em tela cheia) e quando o
 * dock já está aberto. Convive com o ⌘K e o item da sidebar.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { fetchAiAccess } from '@/components/assistant/command-bar/command-bar'
import { useCommunicationStore } from '@/stores/communication-store'

export function AssistantLauncher() {
    const pathname = usePathname()
    const [allowed, setAllowed] = useState(false)
    const isChatOpen = useCommunicationStore(s => s.isOpen)
    const openChat = useCommunicationStore(s => s.openChat)

    useEffect(() => {
        let active = true
        fetchAiAccess().then((a) => {
            if (active && a) setAllowed(a.allowed)
        })
        return () => { active = false }
    }, [])

    // Não mostra na home do Assistente, com o dock já aberto, nem sem acesso à IA.
    if (!allowed || isChatOpen || pathname?.startsWith('/assistente')) return null

    return (
        <button
            type="button"
            onClick={() => openChat()}
            aria-label="Abrir o Assistente IA"
            className="group fixed bottom-6 right-6 z-float flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-transform duration-200 hover:scale-105"
        >
            <span className="absolute inset-0 rounded-[18px] border-2 border-[#A78BFA] opacity-0 group-hover:animate-ping" />
            <Sparkles className="h-[25px] w-[25px]" strokeWidth={1.8} />
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-[#E8E8ED] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-k-border-subtle dark:bg-surface-elevated dark:text-foreground">
                Assistente IA
            </span>
        </button>
    )
}
