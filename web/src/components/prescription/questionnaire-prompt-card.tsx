'use client'

import { useState } from 'react'
import { ClipboardList, Send, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================================================
// Props
// ============================================================================

interface QuestionnairePromptCardProps {
    studentName: string
    onSend: () => Promise<void>
    onSkip: () => void
}

// ============================================================================
// Component
// ============================================================================

export function QuestionnairePromptCard({
    studentName,
    onSend,
    onSkip,
}: QuestionnairePromptCardProps) {
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
    const [error, setError] = useState<string | null>(null)

    const handleSend = async () => {
        setStatus('sending')
        setError(null)
        try {
            await onSend()
            setStatus('sent')
        } catch (err: any) {
            setError(err?.message || 'Erro ao enviar questionário')
            setStatus('idle')
        }
    }

    if (status === 'sent') {
        return (
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-violet-500/20 p-6 mb-6">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-k-text-primary">
                            Questionário enviado
                        </h3>
                        <p className="text-sm text-k-text-tertiary mt-1 leading-relaxed">
                            {studentName} recebeu o questionário no app. Quando responder, volte a esta tela para gerar o programa com dados mais completos.
                        </p>
                        <div className="mt-4">
                            <Button
                                onClick={onSkip}
                                variant="outline"
                                className="border-k-border-primary text-k-text-secondary text-sm"
                            >
                                Prosseguir sem aguardar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6 mb-6">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-bold text-k-text-primary">
                        Questionário de Prescrição não respondido
                    </h3>
                    <p className="text-sm text-k-text-tertiary mt-1 leading-relaxed">
                        Para um programa mais assertivo, recomendamos que {studentName} responda o questionário de prescrição antes da geração. São 5 minutos.
                    </p>

                    {error && (
                        <p className="text-sm text-red-400 mt-2">{error}</p>
                    )}

                    <div className="flex items-center gap-3 mt-4">
                        <Button
                            onClick={handleSend}
                            disabled={status === 'sending'}
                            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
                        >
                            {status === 'sending' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar ao aluno
                                </>
                            )}
                        </Button>
                        <button
                            onClick={onSkip}
                            disabled={status === 'sending'}
                            className="text-sm text-k-text-tertiary hover:text-k-text-secondary transition-colors disabled:opacity-50"
                        >
                            Prosseguir sem questionário
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
