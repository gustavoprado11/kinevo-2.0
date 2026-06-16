'use client'

/**
 * ToolConfirmationCard — card de HITL (Fase 1 · IA do Treinador, Trilha 1).
 *
 * Consome um ToolConfirmationRequest (contrato compartilhado em hitl-types) e
 * renderiza o card de confirmação fiel ao mock `ai-trainer-mock-commandbar.html`
 * (.pact): ícone, título, resumo dos argumentos, selo "Requer confirmação" e os
 * botões Revisar / Confirmar. Ações destrutivas usam o estilo de alerta.
 *
 * Ao confirmar, executa a tool real via POST /api/assistant/execute-tool (já
 * existente — revalida tier+cota e registra o crédito). O componente é só
 * apresentação + a chamada de confirmação; o estado de turno vive no pai.
 */

import { useState } from 'react'
import { Check, AlertTriangle, CreditCard, Loader2, X } from 'lucide-react'
import type {
    ToolConfirmationRequest,
    ToolConfirmationResult,
} from '@/lib/assistant/hitl-types'
import type { AiSurface } from '@/lib/ai-usage/metering'

interface ToolConfirmationCardProps {
    request: ToolConfirmationRequest
    surface?: AiSurface
    /** Chamado após a decisão humana (confirmado/cancelado) com o resultado da tool. */
    onResolved?: (result: ToolConfirmationResult, toolResult?: unknown) => void
    /** Cancelar/descartar o card sem executar. */
    onCancel?: () => void
}

export function ToolConfirmationCard({
    request,
    surface = 'command_bar',
    onResolved,
    onCancel,
}: ToolConfirmationCardProps) {
    const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const destructive = request.destructive

    const handleConfirm = async () => {
        setStatus('running')
        setErrorMsg(null)
        try {
            const res = await fetch('/api/assistant/execute-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolName: request.toolName, args: request.args, surface }),
            })
            const data: unknown = await res.json().catch(() => ({}))
            if (!res.ok) {
                const msg =
                    (data as { message?: string; error?: string })?.message ??
                    (data as { error?: string })?.error ??
                    'Não foi possível executar a ação.'
                setErrorMsg(msg)
                setStatus('error')
                return
            }
            setStatus('done')
            onResolved?.({ confirmed: true }, (data as { result?: unknown })?.result)
        } catch {
            setErrorMsg('Falha de conexão ao executar a ação.')
            setStatus('error')
        }
    }

    const handleCancel = () => {
        onResolved?.({ confirmed: false })
        onCancel?.()
    }

    const accentBg = destructive ? '#FF3B30' : '#F59E0B'
    const wrapBorder = destructive ? 'border-[#F5C2C0]' : 'border-[#E7DBC0]'
    const wrapBg = destructive
        ? 'bg-gradient-to-r from-[#FEF2F2] to-white'
        : 'bg-gradient-to-r from-[#FEF9ED] to-white'

    return (
        <div className={`mx-2.5 rounded-xl border ${wrapBorder} ${wrapBg} p-3.5`}>
            <div className="flex items-start gap-3">
                <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-white"
                    style={{ background: accentBg }}
                >
                    {destructive ? (
                        <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2} />
                    ) : (
                        <CreditCard className="h-[18px] w-[18px]" strokeWidth={2} />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <b className="block text-sm font-semibold text-[#1D1D1F]">{request.title}</b>
                    <span className="block text-xs text-[#6E6E73]">{request.summary}</span>
                    <code className="mt-1 inline-block rounded bg-[#F4F1FE] px-1.5 py-0.5 font-mono text-[11px] text-[#7C3AED]">
                        {request.toolName}
                    </code>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                        destructive
                            ? 'border-[#F0BABA] bg-[#FDE3E3] text-[#B91C1C]'
                            : 'border-[#F0E0BA] bg-[#FDF1D6] text-[#B45309]'
                    }`}
                >
                    {destructive ? 'Ação destrutiva — requer confirmação' : 'Requer confirmação'}
                </span>

                <div className="ml-auto flex items-center gap-2">
                    {status !== 'done' && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={status === 'running'}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D2D2D7] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] disabled:opacity-50"
                        >
                            <X className="h-3 w-3" strokeWidth={2.5} />
                            Cancelar
                        </button>
                    )}
                    {status !== 'done' && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={status === 'running'}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity disabled:opacity-60"
                            style={{ background: destructive ? '#FF3B30' : '#7C3AED' }}
                        >
                            {status === 'running' ? (
                                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                            ) : (
                                <Check className="h-3 w-3" strokeWidth={3} />
                            )}
                            {status === 'running' ? 'Executando…' : 'Confirmar ↵'}
                        </button>
                    )}
                    {status === 'done' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#DCFCE7] px-3 py-1.5 text-xs font-bold text-[#15803D]">
                            <Check className="h-3 w-3" strokeWidth={3} />
                            Feito
                        </span>
                    )}
                </div>
            </div>

            {errorMsg && (
                <p className="mt-2 text-xs font-medium text-[#FF3B30]">{errorMsg}</p>
            )}
        </div>
    )
}
