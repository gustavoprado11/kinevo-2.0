import Link from 'next/link'
import { Bot, ChevronRight } from 'lucide-react'

/**
 * Card de "Integração com IA" — substitui o Link solto que antes ficava entre
 * os cards. Pareia visualmente com o ProfileForm na seção "01 · Você"
 * (mesma altura via h-full + flex-col + mt-auto na CTA).
 */
export function DeveloperLinkCard() {
    return (
        <div className="flex h-full flex-col rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-k-text-primary">Integração com IA</h2>
                    <p className="text-xs text-k-text-tertiary">Conecte Claude.ai ou ChatGPT à sua conta.</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Bot size={16} strokeWidth={1.5} />
                </div>
            </div>

            <p className="text-[13px] leading-relaxed text-k-text-secondary">
                Gere e ajuste treinos em linguagem natural usando o MCP do Kinevo nas suas ferramentas de IA preferidas.
            </p>

            <Link
                href="/settings/api-keys"
                className="group mt-auto flex items-center gap-3 rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-2.5 transition-all hover:border-violet-500/30 hover:bg-violet-500/5"
            >
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-bold text-k-text-primary">Abrir IA &amp; API keys</span>
                    <span className="text-[11px] text-k-text-quaternary">Gerencie suas chaves e conexões.</span>
                </div>
                <ChevronRight size={16} className="text-k-text-quaternary transition-colors group-hover:text-violet-500" />
            </Link>
        </div>
    )
}
