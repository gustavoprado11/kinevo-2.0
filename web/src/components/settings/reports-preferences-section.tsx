'use client'

import { useState, useTransition } from 'react'
import { FileText, Check } from 'lucide-react'
import { updateAutoPublishReports } from '@/actions/trainer/update-auto-publish-reports'

interface ReportsPreferencesSectionProps {
    initialAutoPublish: boolean
}

export function ReportsPreferencesSection({ initialAutoPublish }: ReportsPreferencesSectionProps) {
    const [autoPublish, setAutoPublish] = useState(initialAutoPublish)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleToggle = () => {
        const next = !autoPublish
        setAutoPublish(next) // optimistic
        setError(null)

        startTransition(async () => {
            const result = await updateAutoPublishReports(next)
            if (!result.success) {
                setAutoPublish(!next) // rollback
                setError(result.message || 'Não foi possível salvar sua preferência.')
            }
        })
    }

    return (
        <div className="bg-surface-card border border-k-border-primary rounded-2xl p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-k-text-primary">Relatórios</h2>
                    <p className="text-sm text-k-text-tertiary mt-1">Como os relatórios chegam nos alunos.</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <FileText size={18} strokeWidth={1.5} />
                </div>
            </div>

            <div className="flex items-start justify-between gap-4 bg-surface-inset rounded-xl p-4 border border-k-border-subtle">
                <div className="flex-1">
                    <label htmlFor="auto-publish-toggle" className="block text-sm font-semibold text-k-text-primary cursor-pointer">
                        Publicar automaticamente
                    </label>
                    <p className="text-xs text-k-text-tertiary mt-1 leading-relaxed">
                        Quando ligado, relatórios gerados saem já publicados e o aluno recebe a
                        notificação na hora. Desligado: você gera, revisa e decide quando publicar.
                    </p>
                </div>

                <button
                    id="auto-publish-toggle"
                    type="button"
                    role="switch"
                    aria-checked={autoPublish}
                    onClick={handleToggle}
                    disabled={isPending}
                    className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors ${
                        autoPublish ? 'bg-violet-600' : 'bg-k-border-primary'
                    } ${isPending ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
                >
                    <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            autoPublish ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                    />
                </button>
            </div>

            <p className="text-[10px] font-bold text-k-text-quaternary mt-4 flex items-center gap-1.5">
                {isPending ? (
                    'Salvando preferência...'
                ) : autoPublish ? (
                    <>
                        <Check size={12} strokeWidth={3} className="text-emerald-500" />
                        Auto-publicação ativa — próximos relatórios vão direto pros alunos.
                    </>
                ) : (
                    'Próximos relatórios vão ficar como rascunho pra você revisar.'
                )}
            </p>

            {error && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 px-3 py-2 text-sm">
                    {error}
                </div>
            )}
        </div>
    )
}
