'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

interface BuilderShellProps {
    /**
     * Texto principal do header (geralmente o título do template em edição).
     * Quando o template ainda não tem nome, passar string descritiva
     * (ex.: "Novo template").
     */
    title: string
    /** Subtítulo opcional, aparece abaixo do title em fonte menor. */
    subtitle?: string | null
    /**
     * Disparado quando o usuário pede pra sair (botão Voltar). O shell já
     * mostra o modal de confirmação se isDirty=true; só chama esta callback
     * após confirmação (ou imediatamente se não houver mudanças).
     */
    onExit: () => void
    /**
     * Disparado quando o usuário clica Salvar. Pode ser undefined se o ponto
     * atual do flow não tem ação de salvar (ex.: steps iniciais de wizard).
     */
    onSave?: () => void | Promise<void>
    /** Habilita/desabilita o botão Salvar. */
    canSave?: boolean
    /** Indica que existem alterações não salvas. */
    isDirty?: boolean
    /** Render do botão Salvar mostra spinner. */
    isSaving?: boolean
    /**
     * Quando provido, o shell faz limpeza do draft (localStorage) ao montar
     * apenas se chamado por um filho via `clearDraft`. Para auto-cleanup pós
     * save, o caller é responsável (já que conhece o ciclo do save).
     *
     * O BuilderShell em si NÃO escreve drafts — quem conhece o shape dos
     * dados é o canvas filho. O shell expõe a key padronizada como
     * referência consistente.
     */
    draftKey?: string
    /** Conteúdo principal — canvas/wizard injetado pelo caller. */
    children: ReactNode
    /** Override opcional do label do botão Salvar (default "Salvar"). */
    saveLabel?: string
    /** Esconde o botão Salvar (útil pra wizard steps iniciais). */
    hideSave?: boolean
}

// M8/D2 — shell compartilhado pelos builders de Form e Assessment.
// Cuida de header, save, exit (com confirmação), modal "Sair sem salvar?".
// Canvas filho continua dono do draft localStorage (ele conhece o shape).
export function BuilderShell({
    title,
    subtitle,
    onExit,
    onSave,
    canSave = true,
    isDirty = false,
    isSaving = false,
    draftKey: _draftKey,
    children,
    saveLabel = 'Salvar',
    hideSave = false,
}: BuilderShellProps) {
    const [confirmExitOpen, setConfirmExitOpen] = useState(false)

    const requestExit = () => {
        if (isDirty) {
            setConfirmExitOpen(true)
        } else {
            onExit()
        }
    }

    // beforeunload guard — protege F5/fechar aba quando dirty.
    useEffect(() => {
        if (!isDirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [isDirty])

    return (
        <div className="flex min-h-[calc(100vh-8rem)] flex-col">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3 rounded-panel border border-k-border-subtle bg-surface-card px-4 py-3">
                <button
                    type="button"
                    onClick={requestExit}
                    className="flex items-center gap-1 rounded-control px-2 py-1 text-sm text-k-text-secondary hover:bg-surface-inset"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </button>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-k-text-primary">
                        {title || 'Sem título'}
                    </div>
                    {subtitle && (
                        <div className="mt-0.5 truncate text-xs text-k-text-tertiary">
                            {subtitle}
                        </div>
                    )}
                </div>
                {isDirty && (
                    <span className="text-[11px] text-k-text-tertiary whitespace-nowrap">
                        Alterações não salvas
                    </span>
                )}
                {!hideSave && onSave && (
                    <button
                        type="button"
                        onClick={() => { void onSave() }}
                        disabled={!canSave || isSaving}
                        className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {saveLabel}
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>

            {/* Confirm exit modal */}
            {confirmExitOpen && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setConfirmExitOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-k-border-subtle bg-surface-card p-6 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Sair sem salvar?
                        </h3>
                        <p className="mt-2 text-sm text-k-text-tertiary">
                            Você tem alterações não salvas. Se sair agora elas serão perdidas.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmExitOpen(false)}
                                className="rounded-control border border-k-border-primary bg-transparent px-3 py-1.5 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
                            >
                                Continuar editando
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setConfirmExitOpen(false)
                                    onExit()
                                }}
                                className="rounded-control bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
                            >
                                Sair sem salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
