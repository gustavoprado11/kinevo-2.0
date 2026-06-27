'use client'

/**
 * CommandBar — barra de comando ⌘K da IA do Treinador (Fase 1 · Trilha 1).
 *
 * Overlay que opera a TELA ATUAL: o treinador digita uma intenção, a IA entende,
 * executa leituras/ações simples e PAUSA nas ações sensíveis com um card de
 * confirmação (HITL). Espelha o mock `ai-trainer-mock-commandbar.html`.
 *
 * Gate em 2 níveis: o componente só é montado quando o tier tem o Assistente (a UI esconde via
 * `fetchAiAccess`) e o handler /api/assistant/command revalida tier+cota. Quando
 * a cota esgota (402), degrada pra GUI com um banner — nunca trava o app.
 *
 * Reusa contratos compartilhados: CreditMeter (medidor), hitl-types (confirmação).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { IntentInput } from './intent-input'
import { ActionPreview, type CommandTurnResult } from './action-preview'
import { CreditMeter } from '@/components/assistant/credit-meter'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AiTier } from '@/lib/auth/get-ai-tier'
import type { ToolConfirmationResult } from '@/lib/assistant/hitl-types'

// ----------------------------------------------------------------------------
// Acesso (gate de UI) — compartilhado por sidebar e command-palette.
// ----------------------------------------------------------------------------
export type HomeStyle = 'classic' | 'assistant'

export interface AiAccess {
    tier: AiTier
    allowed: boolean
    /** Preferência de Início do treinador (migration 210). Ausente em respostas antigas. */
    homeStyle?: HomeStyle
    summary: AiUsageSummary
}

/** Evento global para abrir a barra de comando de IA (ex.: item da sidebar). */
export const OPEN_AI_COMMAND_EVENT = 'kinevo:open-ai-command'

// Cache do gate de UI (allowed) para o toggle Clássico/Assistente aparecer
// imediatamente em navegações client-side (ex.: voltar do Assistente), sem
// esperar o fetch. Memo em memória + localStorage. NUNCA ler no servidor (o
// módulo é compartilhado entre requests — vazaria entre usuários).
const AI_ALLOWED_CACHE_KEY = 'kinevo:ai-allowed'
let aiAllowedMemo: boolean | null = null

/** Grava o cache do gate de IA (client-only). */
export function setCachedAiAllowed(v: boolean): void {
    if (typeof window === 'undefined') return
    aiAllowedMemo = v
    try { window.localStorage.setItem(AI_ALLOWED_CACHE_KEY, v ? '1' : '0') } catch { /* noop */ }
}

/** Leitura síncrona do último acesso conhecido (client-only; false no server). */
export function getCachedAiAllowed(): boolean {
    if (typeof window === 'undefined') return false
    if (aiAllowedMemo !== null) return aiAllowedMemo
    try {
        return window.localStorage.getItem(AI_ALLOWED_CACHE_KEY) === '1'
    } catch {
        return false
    }
}

// Cache do modo de Início (classic|assistant) — mesmo motivo do aiAllowed: o
// toggle e o destino do "Dashboard" precisam refletir o modo já na 1ª pintura,
// sem flash. Memo + localStorage. NUNCA ler no servidor.
const HOME_STYLE_CACHE_KEY = 'kinevo:home-style'
let homeStyleMemo: HomeStyle | null = null

/** Grava o cache do modo de Início (client-only). */
export function setCachedHomeStyle(v: HomeStyle): void {
    if (typeof window === 'undefined') return
    homeStyleMemo = v
    try { window.localStorage.setItem(HOME_STYLE_CACHE_KEY, v) } catch { /* noop */ }
}

/** Leitura síncrona do último modo conhecido (client-only; 'classic' no server). */
export function getCachedHomeStyle(): HomeStyle {
    if (typeof window === 'undefined') return 'classic'
    if (homeStyleMemo !== null) return homeStyleMemo
    try {
        return window.localStorage.getItem(HOME_STYLE_CACHE_KEY) === 'assistant' ? 'assistant' : 'classic'
    } catch {
        return 'classic'
    }
}

/**
 * Lê o acesso à superfície de IA (tier + cota) do treinador logado.
 * Retorna null em falha/sem-auth (a UI simplesmente não mostra a superfície).
 */
export async function fetchAiAccess(): Promise<AiAccess | null> {
    try {
        const res = await fetch('/api/assistant/command', { method: 'GET' })
        if (!res.ok) return null
        const data = (await res.json()) as AiAccess
        if (!data || typeof data.allowed !== 'boolean') return null
        aiAllowedMemo = data.allowed
        try { window.localStorage.setItem(AI_ALLOWED_CACHE_KEY, data.allowed ? '1' : '0') } catch { /* noop */ }
        if (data.homeStyle === 'assistant' || data.homeStyle === 'classic') setCachedHomeStyle(data.homeStyle)
        return data
    } catch {
        return null
    }
}

// ----------------------------------------------------------------------------
// Sugestões por rota (mock: "Sugestões nesta tela").
// ----------------------------------------------------------------------------
function suggestionsForRoute(route: string): string[] {
    if (route.startsWith('/financial')) {
        return [
            'Mostre os alunos inadimplentes',
            'Qual o MRR e quantos assinantes ativos?',
        ]
    }
    if (route.startsWith('/students')) {
        return [
            'Quem não treina há mais de 7 dias?',
            'Resuma o progresso recente dos meus alunos',
        ]
    }
    if (route.startsWith('/schedule')) {
        return ['Quais sessões tenho hoje?', 'Liste a agenda da semana']
    }
    if (route.startsWith('/forms') || route.startsWith('/avaliacoes')) {
        return ['Envie o check-in da semana', 'Quais respostas de formulário chegaram?']
    }
    return ['Resuma como estão meus alunos hoje', 'Há algum alerta importante?']
}

interface CommandBarProps {
    open: boolean
    onClose: () => void
    initialQuery?: string
    /** Rota atual (contexto). Se omitido, usa o pathname. */
    route?: string
    /** Acesso já carregado (evita refetch). */
    access?: AiAccess | null
    /** Aluno em foco (UUID), quando a tela é de um aluno específico. */
    studentId?: string
}

export function CommandBar({
    open,
    onClose,
    initialQuery,
    route,
    access: accessProp,
    studentId,
}: CommandBarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const currentRoute = route ?? pathname ?? ''

    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [turn, setTurn] = useState<CommandTurnResult | null>(null)
    const [access, setAccess] = useState<AiAccess | null>(accessProp ?? null)
    const [banner, setBanner] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const summary: AiUsageSummary | null = turn?.summary ?? access?.summary ?? null

    const runCommand = useCallback(
        async (text: string) => {
            const trimmed = text.trim()
            if (!trimmed || loading) return
            setLoading(true)
            setBanner(null)
            try {
                const res = await fetch('/api/assistant/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: trimmed, route: currentRoute, studentId }),
                })
                const data: unknown = await res.json().catch(() => ({}))
                if (!res.ok) {
                    const msg =
                        (data as { message?: string })?.message ??
                        (data as { error?: string })?.error ??
                        'Não foi possível processar o comando.'
                    setBanner(msg)
                    setTurn(null)
                    return
                }
                setTurn(data as CommandTurnResult)
            } catch {
                setBanner('Falha de conexão. Tente novamente.')
            } finally {
                setLoading(false)
            }
        },
        [currentRoute, loading, studentId],
    )

    // Reset + carrega acesso ao abrir; pré-preenche e roda a query inicial.
    useEffect(() => {
        if (!open) return
        setTurn(null)
        setBanner(null)
        setInput(initialQuery ?? '')
        if (!accessProp) {
            fetchAiAccess().then((a) => {
                if (a) setAccess(a)
            })
        } else {
            setAccess(accessProp)
        }
        const t = setTimeout(() => inputRef.current?.focus(), 30)
        if (initialQuery && initialQuery.trim().length > 0) {
            runCommand(initialQuery)
        }
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialQuery])

    // Fecha no Escape.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open, onClose])

    const handleConfirmationResolved = useCallback(
        (decision: ToolConfirmationResult) => {
            // Após executar (ou cancelar) a ação, reflete a mudança na tela atual
            // e atualiza o medidor de cota.
            if (decision.confirmed) {
                router.refresh()
                fetchAiAccess().then((a) => {
                    if (a) setAccess(a)
                })
            }
        },
        [router],
    )

    if (!open) return null

    const exhausted = summary?.exhausted ?? false
    const suggestions = suggestionsForRoute(currentRoute)

    return (
        <div className="fixed inset-0 z-float" role="dialog" aria-modal="true" aria-label="Assistente IA">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-[#14141E]/40 backdrop-blur-[2px]"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Palette */}
            <div className="fixed left-1/2 top-[14%] w-full max-w-[640px] -translate-x-1/2 px-4">
                <div className="overflow-hidden rounded-2xl border border-[#D2D2D7] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06),0_24px_60px_-24px_rgba(0,0,0,0.22)]">
                    <IntentInput
                        ref={inputRef}
                        value={input}
                        onChange={setInput}
                        onSubmit={() => runCommand(input)}
                        loading={loading}
                    />

                    {/* Banner de cota/erro — degrada pra GUI, não trava. */}
                    {(banner || exhausted) && (
                        <div className="mx-2.5 mt-2.5 flex items-start gap-2.5 rounded-xl border border-[#F0E0BA] bg-[#FEF9ED] px-3.5 py-2.5">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" strokeWidth={2} />
                            <p className="text-[12.5px] leading-snug text-[#92580C]">
                                {banner ??
                                    'Sua cota de IA deste ciclo acabou. Você pode continuar pela interface normal — os créditos renovam em breve.'}
                            </p>
                        </div>
                    )}

                    {/* Resultado do turno (preview + HITL + ações executadas). */}
                    {turn && (
                        <ActionPreview result={turn} onConfirmationResolved={handleConfirmationResolved} />
                    )}

                    {/* Sugestões nesta tela (só quando não há turno em andamento). */}
                    {!turn && !banner && (
                        <div className="pb-2 pt-1">
                            <p className="px-[18px] pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8A8A8E]">
                                Sugestões nesta tela
                            </p>
                            {suggestions.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => {
                                        setInput(s)
                                        runCommand(s)
                                    }}
                                    disabled={loading || exhausted}
                                    className="flex w-full items-center gap-2.5 px-[18px] py-2 text-left transition-colors hover:bg-[#F4F1FE] disabled:opacity-50"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#6E6E73]">
                                        <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2} />
                                    </span>
                                    <span className="flex-1 text-[13.5px] font-medium text-[#1D1D1F]">{s}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Footer: medidor de créditos + atalhos. */}
                    <div className="border-t border-[#E8E8ED] bg-[#FCFCFD] px-[18px] py-2.5">
                        {summary && <CreditMeter summary={summary} compact />}
                        <div className="mt-2 flex items-center gap-4 text-[11.5px] text-[#6E6E73]">
                            <span className="flex items-center gap-1">
                                <kbd className="rounded border border-[#D2D2D7] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#1D1D1F]">
                                    ↵
                                </kbd>
                                executar
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="rounded border border-[#D2D2D7] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#1D1D1F]">
                                    esc
                                </kbd>
                                fechar
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
