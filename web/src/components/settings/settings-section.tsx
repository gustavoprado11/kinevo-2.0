import type { ReactNode } from 'react'

interface SettingsSectionProps {
    /** Número da seção (ex.: "01"). Aparece em violet antes do título. */
    number: string
    /** Título da seção (ex.: "Você", "Sua marca"). */
    title: string
    /** Hint à direita, descrevendo o propósito do grupo. */
    hint?: string
    children: ReactNode
}

/**
 * Wrapper de seção da página de Configurações.
 * Eyebrow numerada + regra sutil + hint, seguidos pelos cards do grupo.
 * Hierarquia em 3 níveis: Página → Seção → Card.
 */
export function SettingsSection({ number, title, hint, children }: SettingsSectionProps) {
    return (
        <section className="mb-10 last:mb-0">
            <div className="mb-5 flex items-center gap-4">
                <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[2.4px] text-k-text-tertiary">
                    <span className="text-violet-600 dark:text-violet-400">{number}</span>
                    <span>{title}</span>
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-k-border-primary to-transparent" />
                {hint && (
                    <span className="hidden text-[11.5px] text-k-text-quaternary md:inline">
                        {hint}
                    </span>
                )}
            </div>
            {children}
        </section>
    )
}
