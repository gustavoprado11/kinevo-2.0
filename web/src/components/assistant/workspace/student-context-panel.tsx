'use client'

/**
 * StudentContextPanel — coluna de contexto do aluno no /assistente (F1).
 *
 * 3ª coluna do workspace. Reage ao aluno em foco (rail) ou ao aluno da conversa
 * ativa. SEM aluno o painel fica oculto (width 0); selecionar um aluno anima a
 * entrada (width 0→340, 220ms). Estados visíveis: card (com skeleton no fetch)
 * e rail colapsado (60px). Leitura + pré-armar o composer — não dispara tools.
 * Estilo Shield Strategy (§2.3): light hex + par dark: com tokens semânticos.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    User, MessageCircle, Dumbbell, ChevronRight, ChevronLeft, X,
    TrendingUp, TrendingDown, FileText,
} from 'lucide-react'
import type { StudentContextPayload } from '@/lib/assistant/student-panel-data'
import type { AttentionKind } from '@/lib/assistant/attention'
import { avatarFor } from './ui-util'

// Cache por id entre montagens — a F1 só refaz o fetch na troca de aluno.
const CACHE = new Map<string, StudentContextPayload>()

interface UseStudentContext {
    data: StudentContextPayload | null
    loading: boolean
    error: boolean
    reload: () => void
}

function useStudentContext(studentId: string | null): UseStudentContext {
    // O payload vive em STATE (`entry`), não derivado do CACHE em tempo de render:
    // com o React Compiler ligado, ler um Map mutável módulo-level no corpo do
    // componente é memoizado por `studentId` e não reage à mutação do Map depois
    // do fetch. O CACHE é só um atalho entre focos; a verdade reativa é `entry`.
    const [entry, setEntry] = useState<{ id: string; data: StudentContextPayload } | null>(null)
    const [errId, setErrId] = useState<string | null>(null)
    const [nonce, setNonce] = useState(0)

    useEffect(() => {
        if (!studentId) return
        const cached = CACHE.get(studentId)
        if (cached && nonce === 0) {
            // Reflete o cache sem setState síncrono no corpo do efeito (regra do lint):
            // um microtask agenda o setState fora do corpo.
            let alive = true
            Promise.resolve().then(() => { if (alive) setEntry({ id: studentId, data: cached }) })
            return () => { alive = false }
        }
        let cancelled = false
        fetch(`/api/assistant/student-context/${studentId}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(String(res.status))
                return res.json() as Promise<StudentContextPayload>
            })
            .then((payload) => {
                CACHE.set(studentId, payload)
                if (!cancelled) setEntry({ id: studentId, data: payload })
            })
            .catch(() => { if (!cancelled) setErrId(studentId) })
        return () => { cancelled = true }
    }, [studentId, nonce])

    const current = entry && entry.id === studentId ? entry : null
    const data = current?.data ?? null
    const error = !!studentId && errId === studentId && !data
    const loading = !!studentId && !data && !error

    // reload: limpa o cache e o erro deste aluno → o efeito (via nonce) refaz o fetch.
    const reload = () => {
        if (studentId) CACHE.delete(studentId)
        setErrId((prev) => (prev === studentId ? null : prev))
        setNonce((n) => n + 1)
    }

    return { data, loading, error, reload }
}

const ALERT_STYLE: Record<AttentionKind, { cls: string; icon: typeof TrendingUp }> = {
    pronto_para_evoluir: { cls: 'text-[#15803D] bg-[#F0FDF4] dark:text-green-400 dark:bg-green-500/10', icon: TrendingUp },
    estagnado: { cls: 'text-[#B45309] bg-[#FFFBEB] dark:text-amber-400 dark:bg-amber-500/10', icon: TrendingDown },
    nota: { cls: 'text-[#2563EB] bg-[#EFF6FF] dark:text-blue-400 dark:bg-blue-500/10', icon: FileText },
}

const EYEBROW = 'text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#86868B] dark:text-muted-foreground/60'

interface Props {
    studentId: string | null
    /** Aluno vindo do escopo da conversa: esconde o × (escopo é fixo). */
    fromConversation: boolean
    open: boolean
    onToggle: () => void
    onRemove: () => void
    /** Preenche o composer (fillInput) — não envia. */
    onPrefill: (prompt: string) => void
}

export function StudentContextPanel({ studentId, fromConversation, open, onToggle, onRemove, onPrefill }: Props) {
    const { data, loading, error, reload } = useStudentContext(studentId)
    const hasStudent = !!studentId

    // Sem aluno o painel NÃO existe (width 0); selecionar um aluno anima a
    // entrada 0→340 (mesmo <aside> sempre montado — a transição de width só
    // dispara se o nó persiste). Conteúdo em largura fixa interna para não
    // espremer durante a animação; overflow-hidden faz o clip do reveal.
    const width = hasStudent ? (open ? 340 : 60) : 0

    return (
        <aside
            aria-hidden={!hasStudent}
            style={{ width, transition: 'width 220ms cubic-bezier(0.16,1,0.3,1)' }}
            className={`hidden shrink-0 flex-col overflow-hidden bg-[#F5F5F7] dark:bg-background lg:flex ${hasStudent ? 'border-l border-[#EDEDF0] dark:border-k-border-subtle' : ''}`}
        >
            {hasStudent && !open && (
                // ── Colapsado: rail vertical de 60px ──
                <div className="flex h-full w-[60px] flex-col items-center py-4">
                    <button
                        onClick={onToggle}
                        aria-label="Expandir contexto do aluno"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#EDEDF0] bg-white text-[#6E6E73] transition hover:bg-[#FAFAFA] dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg"
                    >
                        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <span className="mt-3 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[10.5px] font-bold leading-none text-white dark:bg-violet-500">
                        1
                    </span>
                    <button
                        onClick={onToggle}
                        className="mt-3 flex-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B] dark:text-muted-foreground/60"
                        style={{ writingMode: 'vertical-rl' }}
                        aria-label="Expandir contexto do aluno"
                    >
                        CONTEXTO
                    </button>
                </div>
            )}

            {hasStudent && open && (
                // ── Aberto ──
                <div className="flex h-full w-[340px] flex-col">
                    {/* Header */}
                    <div className="flex items-center gap-2 border-b border-[#EDEDF0] px-4 py-3.5 dark:border-k-border-subtle">
                        <span className="text-[13.5px] font-bold tracking-[-0.01em] text-[#1D1D1F] dark:text-foreground">Contexto do aluno</span>
                        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EDE9FE] px-1 text-[10.5px] font-bold leading-none text-[#7C3AED] dark:bg-violet-500/15 dark:text-violet-300">
                            1
                        </span>
                        <button
                            onClick={onToggle}
                            aria-label="Colapsar contexto do aluno"
                            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-[#EDEDF0] bg-white text-[#6E6E73] transition hover:bg-[#FAFAFA] dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg"
                        >
                            <ChevronRight className="h-4 w-4" strokeWidth={2} />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {loading && !data ? (
                            <CardSkeleton />
                        ) : error && !data ? (
                            <button onClick={reload} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#EDEDF0] bg-white py-3 text-[13px] font-medium text-[#6E6E73] transition hover:bg-[#FAFAFA] dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg">
                                Não foi possível carregar. Tentar de novo
                            </button>
                        ) : data ? (
                            <StudentCard data={data} fromConversation={fromConversation} onRemove={onRemove} onPrefill={onPrefill} loading={loading} />
                        ) : null}
                    </div>
                </div>
            )}
        </aside>
    )
}

function CardSkeleton() {
    return (
        <div className="animate-pulse rounded-[20px] border border-[#EDEDF0] bg-white p-4 dark:border-k-border-subtle dark:bg-surface-card">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[11px] bg-[#EDEDF0] dark:bg-surface-inset" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-[#EDEDF0] dark:bg-surface-inset" />
                    <div className="h-2.5 w-1/2 rounded bg-[#F0F0F3] dark:bg-surface-inset/70" />
                </div>
            </div>
            <div className="mt-4 h-5 w-1/2 rounded-full bg-[#EDEDF0] dark:bg-surface-inset" />
            <div className="mt-4 h-1.5 w-full rounded-full bg-[#EDEDF0] dark:bg-surface-inset" />
            <div className="mt-5 space-y-2">
                <div className="h-2.5 w-full rounded bg-[#F0F0F3] dark:bg-surface-inset/70" />
                <div className="h-2.5 w-4/5 rounded bg-[#F0F0F3] dark:bg-surface-inset/70" />
            </div>
        </div>
    )
}

interface CardProps {
    data: StudentContextPayload
    fromConversation: boolean
    onRemove: () => void
    onPrefill: (prompt: string) => void
    loading: boolean
}

function StudentCard({ data, fromConversation, onRemove, onPrefill, loading }: CardProps) {
    const { student, program, adherence, alert, history, notes } = data
    const av = avatarFor(student.name)
    const firstName = student.name.split(' ')[0] || student.name

    const programLabel = program
        ? program.durationWeeks
            ? `${program.name} — semana ${program.currentWeek ?? 1} de ${program.durationWeeks}`
            : program.name
        : 'Sem programa ativo'

    const AlertIcon = alert ? ALERT_STYLE[alert.kind].icon : null

    return (
        <div className={`rounded-[20px] border border-[#EDEDF0] bg-white p-4 transition-opacity dark:border-k-border-subtle dark:bg-surface-card ${loading ? 'opacity-60' : ''}`}>
            {/* Cabeçalho do card */}
            <div className="flex items-start gap-3">
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[12px] font-bold"
                    style={{ background: av.bg, color: av.fg }}
                >
                    {av.initials}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F] dark:text-foreground">{student.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[#86868B] dark:text-muted-foreground">{programLabel}</p>
                </div>
                {!fromConversation && (
                    <button
                        onClick={onRemove}
                        aria-label={`Remover ${firstName} do contexto`}
                        className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#AEAEB2] transition hover:bg-[#F5F5F7] hover:text-[#6E6E73] dark:text-muted-foreground/60 dark:hover:bg-glass-bg"
                    >
                        <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                )}
            </div>

            {/* Badge de alerta */}
            {alert && AlertIcon && (
                <button
                    onClick={() => onPrefill(alert.prompt)}
                    className={`mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-none transition hover:brightness-95 ${ALERT_STYLE[alert.kind].cls}`}
                >
                    <AlertIcon className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                    <span className="truncate">{alert.label}</span>
                </button>
            )}

            {/* Aderência */}
            {adherence && (
                <button
                    onClick={() => onPrefill(`Como está a aderência e a frequência de ${firstName} nas últimas semanas? O que devo ajustar?`)}
                    className="mt-4 block w-full text-left"
                >
                    <div className={EYEBROW}>Aderência</div>
                    <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[12.5px] font-medium text-[#1D1D1F] dark:text-foreground">{adherence.done}/{adherence.expected} esta semana</span>
                        <span className="text-[11.5px] font-bold text-[#7C3AED] dark:text-violet-400 [font-variant-numeric:tabular-nums]">{adherence.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EDEDF0] dark:bg-white/10">
                        <div className="h-full rounded-full bg-[#7C3AED] dark:bg-violet-500" style={{ width: `${adherence.pct}%` }} />
                    </div>
                </button>
            )}

            {/* Histórico recente */}
            {history.length > 0 && (
                <div className="mt-4">
                    <div className={EYEBROW}>Histórico recente</div>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                        {history.map((h) => (
                            <li key={h.id} className="flex items-center gap-2 text-[12.5px] text-[#1D1D1F] dark:text-foreground">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C7C7CC] dark:bg-muted-foreground/50" />
                                <span className="min-w-0 flex-1 truncate">{h.text}</span>
                                <span className="shrink-0 text-[11px] text-[#86868B] dark:text-muted-foreground/60">{h.dateLabel}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Notas do treinador */}
            {notes && (
                <div className="mt-4">
                    <div className={EYEBROW}>Notas do treinador</div>
                    <p className="mt-1.5 rounded-[12px] bg-[#FAFAFA] px-3 py-2.5 text-[12.5px] italic leading-relaxed text-[#6E6E73] dark:bg-surface-inset dark:text-muted-foreground">
                        {notes}
                    </p>
                </div>
            )}

            {/* Ações rápidas */}
            <div className="mt-4 flex items-stretch gap-2">
                <ActionButton as="link" href={`/students/${student.id}`} icon={User} label="Perfil" />
                <ActionButton
                    as="button"
                    icon={MessageCircle}
                    label="Mensagem"
                    onClick={() => onPrefill(`Envie uma mensagem para ${firstName}: `)}
                />
                {program ? (
                    <ActionButton as="link" href={`/students/${student.id}/program/${program.id}`} icon={Dumbbell} label="Programa" />
                ) : (
                    <ActionButton
                        as="button"
                        icon={Dumbbell}
                        label="Programa"
                        onClick={() => onPrefill(`Monte um programa de treino para ${firstName} considerando o histórico e o objetivo dele`)}
                    />
                )}
            </div>
        </div>
    )
}

const ACTION_CLS =
    'flex flex-1 flex-col items-center gap-1 rounded-[12px] border border-[#EDEDF0] bg-white py-2.5 text-[10.5px] font-semibold text-[#6E6E73] transition hover:bg-[#FAFAFA] hover:text-[#1D1D1F] dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg dark:hover:text-foreground'

function ActionButton(
    props:
        | { as: 'link'; href: string; icon: typeof User; label: string }
        | { as: 'button'; onClick: () => void; icon: typeof User; label: string },
) {
    const Icon = props.icon
    const inner = (
        <>
            <Icon className="h-4 w-4" strokeWidth={1.9} />
            {props.label}
        </>
    )
    if (props.as === 'link') {
        return <Link href={props.href} className={ACTION_CLS}>{inner}</Link>
    }
    return <button onClick={props.onClick} className={ACTION_CLS}>{inner}</button>
}
