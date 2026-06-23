'use client'

/**
 * ToolConfirmationCard — card de HITL (Fase 1 · IA do Treinador, Trilha 1).
 *
 * Duas variantes:
 *   - COMPACTA (dinheiro/destrutivo): ícone, título, resumo dos args, selo "Requer
 *     confirmação" e Cancelar/Confirmar (fiel ao mock .pact).
 *   - MENSAGEM EDITÁVEL (quando `request.editableField` está setado — ex.: enviar
 *     mensagem ao aluno): a IA já redigiu o texto; o card mostra numa textarea para
 *     o treinador AJUSTAR a vontade e clicar Enviar (sem digitar "confirmo").
 *
 * Ao confirmar, executa a tool real via POST /api/assistant/execute-tool (revalida
 * tier+cota+posse, idempotência C6, registra crédito). O componente é só
 * apresentação + a chamada; o estado de turno vive no pai.
 */

import { useState } from 'react'
import { Check, AlertTriangle, CreditCard, Loader2, X, Send } from 'lucide-react'
import type {
    ToolConfirmationRequest,
    ToolConfirmationResult,
} from '@/lib/assistant/hitl-types'
import type { AiSurface } from '@/lib/ai-usage/metering'

/** Iniciais p/ o avatar do destinatário (ex.: "Giovanna Prado" → "GP"). */
function recipientInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase() || '?'
}

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

    const editField = request.editableField
    const [editValue, setEditValue] = useState<string>(() =>
        editField ? String(request.args[editField] ?? '') : '',
    )

    const destructive = request.destructive

    // Executa a tool (com o valor editado, se houver campo editável).
    const execute = async () => {
        setStatus('running')
        setErrorMsg(null)
        try {
            const args = editField ? { ...request.args, [editField]: editValue } : request.args
            const res = await fetch('/api/assistant/execute-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toolName: request.toolName,
                    args,
                    surface,
                    idempotencyKey: request.idempotencyKey, // C6: dedup re-cliques
                }),
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

    // ── Variante MENSAGEM EDITÁVEL ──
    if (editField) {
        const sent = status === 'done'
        return (
            <div className="mx-2.5 rounded-[16px] border border-[#DDD6FE] dark:border-violet-500/30 bg-white dark:bg-surface-card p-3.5 shadow-[0_6px_20px_-10px_rgba(124,58,237,0.30)]">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                        <Send className="h-[15px] w-[15px]" strokeWidth={2} />
                    </span>
                    <b className="block text-[13.5px] font-bold text-[#1D1D1F] dark:text-foreground">{request.title}</b>
                </div>

                {/* Destinatário EM DESTAQUE — o treinador confere pra quem vai antes de enviar. */}
                {request.recipientName ? (
                    <div className="mt-2.5 flex items-center gap-2.5 rounded-[12px] border border-[#E8E8ED] dark:border-k-border-subtle bg-[#FAFAFA] dark:bg-glass-bg px-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-[12px] font-bold text-[#7C3AED]">
                            {recipientInitials(request.recipientName)}
                        </span>
                        <div className="min-w-0 leading-tight">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868B] dark:text-muted-foreground">Enviar para</span>
                            <b className="block truncate text-[14px] font-bold text-[#1D1D1F] dark:text-foreground">{request.recipientName}</b>
                        </div>
                    </div>
                ) : (
                    <span className="mt-1 block truncate text-[11.5px] text-[#86868B] dark:text-muted-foreground">{request.summary}</span>
                )}

                {sent ? (
                    <div className="mt-2.5 whitespace-pre-wrap rounded-[12px] bg-[#F5F5F7] dark:bg-glass-bg px-3 py-2.5 text-[13.5px] leading-relaxed text-[#1D1D1F] dark:text-foreground">
                        {editValue}
                    </div>
                ) : (
                    <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={3}
                        disabled={status === 'running'}
                        aria-label={request.editableLabel ?? 'Mensagem'}
                        style={{ outline: 'none' }}
                        className="mt-2.5 w-full resize-y rounded-[12px] border border-[#E2E2E7] dark:border-k-border-subtle bg-white dark:bg-surface-elevated px-3 py-2.5 text-[13.5px] leading-relaxed text-[#1D1D1F] dark:text-foreground transition focus:border-[#7C3AED] disabled:opacity-60"
                    />
                )}

                <div className="mt-3 flex items-center gap-2">
                    {!sent && (
                        <>
                            <span className="text-[11px] text-[#AEAEB2] dark:text-muted-foreground/60">Revise antes de enviar</span>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={status === 'running'}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-elevated px-2.5 py-1.5 text-xs font-bold text-[#1D1D1F] dark:text-foreground transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg disabled:opacity-50"
                                >
                                    <X className="h-3 w-3" strokeWidth={2.5} /> Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={execute}
                                    disabled={status === 'running' || !editValue.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.55)] transition hover:brightness-[1.07] disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg,#7C3AED,#8b5cf6)' }}
                                >
                                    {status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /> : <Send className="h-3 w-3" strokeWidth={2.4} />}
                                    {status === 'running' ? 'Enviando…' : 'Enviar'}
                                </button>
                            </div>
                        </>
                    )}
                    {sent && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F0FDF4] dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-[#15803D] dark:text-emerald-300">
                            <Check className="h-3 w-3" strokeWidth={3} /> Mensagem enviada
                        </span>
                    )}
                </div>
                {errorMsg && <p className="mt-2 text-xs font-medium text-[#EF4444]">{errorMsg}</p>}
            </div>
        )
    }

    // ── Variante COMPACTA (dinheiro/destrutivo) ──
    const wrapBorder = destructive ? 'border-[#F5C2C0]' : 'border-[#DDD6FE]'
    const wrapShadow = destructive
        ? 'shadow-[0_6px_20px_-10px_rgba(239,68,68,0.30)]'
        : 'shadow-[0_6px_20px_-10px_rgba(124,58,237,0.30)]'
    const tile = destructive
        ? { background: '#FEF2F2', color: '#BE123C' }
        : { background: '#EDE9FE', color: '#7C3AED' }

    return (
        <div className={`mx-2.5 rounded-[16px] border bg-white ${wrapBorder} ${wrapShadow} p-3.5`}>
            <div className="flex items-start gap-3">
                <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                    style={tile}
                >
                    {destructive ? (
                        <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2} />
                    ) : (
                        <CreditCard className="h-[18px] w-[18px]" strokeWidth={2} />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-bold text-[#1D1D1F]">{request.title}</b>
                    <span className="block text-[11.5px] text-[#86868B]">{request.summary}</span>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        destructive
                            ? 'border-[rgba(239,68,68,0.28)] bg-[#FEF2F2] text-[#BE123C]'
                            : 'border-[rgba(245,158,11,0.28)] bg-[#FFFBEB] text-[#B45309]'
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
                            onClick={execute}
                            disabled={status === 'running'}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.55)] transition hover:brightness-[1.07] disabled:opacity-60"
                            style={{ background: destructive ? '#EF4444' : 'linear-gradient(135deg,#7C3AED,#8b5cf6)' }}
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
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F0FDF4] px-3 py-1.5 text-xs font-bold text-[#15803D]">
                            <Check className="h-3 w-3" strokeWidth={3} />
                            Feito
                        </span>
                    )}
                </div>
            </div>

            {errorMsg && (
                <p className="mt-2 text-xs font-medium text-[#EF4444]">{errorMsg}</p>
            )}
        </div>
    )
}
