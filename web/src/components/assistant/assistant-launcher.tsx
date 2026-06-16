'use client'

/**
 * AssistantLauncher — botão flutuante de acesso rápido ao Assistente (aba /assistente).
 *
 * Bolha global (canto inferior direito), Pro+ apenas. Some na própria aba do
 * Assistente. Convive com o ⌘K (atalho da barra de comando) sem conflito —
 * este é o acesso "de qualquer tela" à conversa persistida.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { fetchAiAccess } from '@/components/assistant/command-bar/command-bar'

export function AssistantLauncher() {
    const pathname = usePathname()
    const [allowed, setAllowed] = useState(false)

    useEffect(() => {
        let active = true
        fetchAiAccess().then((a) => {
            if (active && a) setAllowed(a.allowed)
        })
        return () => { active = false }
    }, [])

    // Não mostra na própria aba, nem fora dos planos Pro+.
    if (!allowed || pathname?.startsWith('/assistente')) return null

    return (
        <Link
            href="/assistente"
            aria-label="Abrir o Assistente IA"
            className="group fixed bottom-6 right-6 z-float flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-transform duration-200 hover:scale-105"
        >
            <span className="absolute inset-0 rounded-[18px] border-2 border-[#A78BFA] opacity-0 group-hover:animate-ping" />
            <Sparkles className="h-[25px] w-[25px]" strokeWidth={1.8} />
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-[#E8E8ED] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-k-border-subtle dark:bg-surface-elevated dark:text-foreground">
                Assistente IA
            </span>
        </Link>
    )
}
