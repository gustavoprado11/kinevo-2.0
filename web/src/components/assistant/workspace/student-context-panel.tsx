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

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
    User, MessageCircle, Dumbbell, ChevronRight, ChevronLeft, X, Pencil, Plus,
    TrendingUp, TrendingDown, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateTrainerNotes } from '@/app/students/[id]/actions/update-trainer-notes'
import type { StudentContextPayload } from '@/lib/assistant/student-panel-data'
import type { AttentionKind } from '@/lib/assistant/attention'
import { avatarFor } from './ui-util'

// Cache por id entre montagens — refaz o fetch na troca de aluno e nas revalidações.
const CACHE = new Map<string, StudentContextPayload>()

interface UseStudentContext {
    data: StudentContextPayload | null
    loading: boolean
    error: boolean
    reload: () => void
    /** Patch local (ex.: notas salvas) — atualiza entry + CACHE sem refetch. */
    mutate: (updater: (d: StudentContextPayload) => StudentContextPayload) => void
}

function useStudentContext(studentId: string | null, refreshKey: number): UseStudentContext {
    // O payload vive em STATE (`entry`), não derivado do CACHE em tempo de render:
    // com o React Compiler ligado, ler um Map mutável módulo-level no corpo do
    // componente é memoizado por `studentId` e não reage à mutação do Map depois
    // do fetch. O CACHE é só um atalho entre focos; a verdade reativa é `entry`.
    const [entry, setEntry] = useState<{ id: string; data: StudentContextPayload } | null>(null)
    const [errId, setErrId] = useState<string | null>(null)
    const [nonce, setNonce] = useState(0)

    // reload: derruba o cache do aluno e refaz o fetch. O card antigo continua
    // visível até o payload novo chegar (stale-while-revalidate) — `entry` não é
    // limpo aqui de propósito.
    const reload = useCallback(() => {
        if (!studentId) return
        CACHE.delete(studentId)
        setErrId((prev) => (prev === studentId ? null : prev))
        setNonce((n) => n + 1)
    }, [studentId])

    // Revalidação pedida pelo workspace (fim de turno / confirmação HITL).
    // reload via microtask: regra react-hooks/set-state-in-effect (padrão do repo).
    const prevRefreshRef = useRef(refreshKey)
    useEffect(() => {
        if (refreshKey === prevRefreshRef.current) return
        prevRefreshRef.current = refreshKey
        let alive = true
        Promise.resolve().then(() => { if (alive) reload() })
        return () => { alive = false }
    }, [refreshKey, reload])

    // Realtime: insight do aluno em foco criado/atualizado (cron, dismissal em
    // outra aba) → revalida o card. A tabela assistant_insights publica realtime
    // (migration 088) e a RLS filtra pelo treinador.
    useEffect(() => {
        if (!studentId) return
        const supabase = createClient()
        const channel = supabase
            .channel(`student-context-${studentId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assistant_insights', filter: `student_id=eq.${studentId}` },
                () => reload(),
            )
            .subscribe()
        return () => { void supabase.removeChannel(channel) }
    }, [studentId, reload])

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

    const mutate = useCallback((updater: (d: StudentContextPayload) => StudentContextPayload) => {
        setEntry((prev) => {
            if (!prev || !studentId || prev.id !== studentId) return prev
            const next = updater(prev.data)
            CACHE.set(studentId, next)
            return { id: prev.id, data: next }
        })
    }, [studentId])

    return { data, loading, error, reload, mutate }
}

const ALERT_STYLE: Record<AttentionKind, { cls: string; icon: typeof TrendingUp }> = {
    pronto_para_evoluir: { cls: 'text-[#15803D] bg-[#F0FDF4] dark:text-green-400 dark:bg-green-500/10', icon: TrendingUp },
    estagnado: { cls: 'text-[#B45309] bg-[#FFFBEB] dark:text-amber-400 dark:bg-amber-500/10', icon: TrendingDown },
    nota: { cls: 'text-[#2563EB] bg-[#EFF6FF] dark:text-blue-400 dark:bg-blue-500/10', icon: FileText },
}

const EYEBROW = 'text-[10.5px] font-bold uppercase tracking-[0.08em] text-k-text-tertiary dark:text-muted-foreground/60'

interface Props {
    studentId: string | null
    /** Aluno vindo do escopo da conversa: esconde o × (escopo é fixo). */
    fromConversation: boolean
    open: boolean
    /** Incrementado pelo workspace quando o card pode ter ficado stale (turno/HITL). */
    refreshKey: number
    onToggle: () => void
    onRemove: () => void
    /** Preenche o composer (fillInput) — não envia. */
    onPrefill: (prompt: string) => void
}

export function StudentContextPanel({ studentId, fromConversation, open, refreshKey, onToggle, onRemove, onPrefill }: Props) {
    const { data, loading, error, reload, mutate } = useStudentContext(studentId, refreshKey)
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
            className={`hidden shrink-0 flex-col overflow-hidden bg-surface-inset dark:bg-background lg:flex ${hasStudent ? 'border-l border-k-border-subtle dark:border-k-border-subtle' : ''}`}
        >
            {hasStudent && !open && (
                // ── Colapsado: rail vertical de 60px ──
                <div className="flex h-full w-[60px] flex-col items-center py-4">
                    <button
                        onClick={onToggle}
                        aria-label="Expandir contexto do aluno"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-k-border-subtle bg-white text-k-text-secondary transition hover:bg-surface-canvas dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg"
                    >
                        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <span className="mt-3 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold leading-none text-white dark:bg-violet-500">
                        1
                    </span>
                    <button
                        onClick={onToggle}
                        className="mt-3 flex-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-k-text-tertiary dark:text-muted-foreground/60"
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
                    <div className="flex items-center gap-2 border-b border-k-border-subtle px-4 py-3.5 dark:border-k-border-subtle">
                        <span className="text-[13.5px] font-bold tracking-[-0.01em] text-k-text-primary dark:text-foreground">Contexto do aluno</span>
                        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EDE9FE] px-1 text-[10.5px] font-bold leading-none text-primary dark:bg-violet-500/15 dark:text-violet-300">
                            1
                        </span>
                        <button
                            onClick={onToggle}
                            aria-label="Colapsar contexto do aluno"
                            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-k-border-subtle bg-white text-k-text-secondary transition hover:bg-surface-canvas dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg"
                        >
                            <ChevronRight className="h-4 w-4" strokeWidth={2} />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {loading && !data ? (
                            <CardSkeleton />
                        ) : error && !data ? (
                            <button onClick={reload} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] border border-k-border-subtle bg-white py-3 text-[13px] font-medium text-k-text-secondary transition hover:bg-surface-canvas dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg">
                                Não foi possível carregar. Tentar de novo
                            </button>
                        ) : data ? (
                            <StudentCard
                                data={data}
                                fromConversation={fromConversation}
                                onRemove={onRemove}
                                onPrefill={onPrefill}
                                onNotesSaved={(notes) => mutate((d) => ({ ...d, notes }))}
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </aside>
    )
}

function CardSkeleton() {
    return (
        <div className="animate-pulse rounded-[20px] border border-k-border-subtle bg-white p-4 dark:border-k-border-subtle dark:bg-surface-card">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[11px] bg-surface-inset dark:bg-surface-inset" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-surface-inset dark:bg-surface-inset" />
                    <div className="h-2.5 w-1/2 rounded bg-[#F0F0F3] dark:bg-surface-inset/70" />
                </div>
            </div>
            <div className="mt-4 h-5 w-1/2 rounded-full bg-surface-inset dark:bg-surface-inset" />
            <div className="mt-4 h-1.5 w-full rounded-full bg-surface-inset dark:bg-surface-inset" />
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
    onNotesSaved: (notes: string | null) => void
}

function StudentCard({ data, fromConversation, onRemove, onPrefill, onNotesSaved }: CardProps) {
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
        <div className="rounded-[20px] border border-k-border-subtle bg-white p-4 dark:border-k-border-subtle dark:bg-surface-card">
            {/* Cabeçalho do card */}
            <div className="flex items-start gap-3">
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[12px] font-bold"
                    style={{ background: av.bg, color: av.fg }}
                >
                    {av.initials}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-k-text-primary dark:text-foreground">{student.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-k-text-tertiary dark:text-muted-foreground">{programLabel}</p>
                </div>
                {!fromConversation && (
                    <button
                        onClick={onRemove}
                        aria-label={`Remover ${firstName} do contexto`}
                        className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-k-text-quaternary transition hover:bg-surface-inset hover:text-k-text-secondary dark:text-muted-foreground/60 dark:hover:bg-glass-bg"
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
                        <span className="text-[12.5px] font-medium text-k-text-primary dark:text-foreground">{adherence.done}/{adherence.expected} esta semana</span>
                        <span className="text-[11.5px] font-bold text-primary dark:text-violet-400 [font-variant-numeric:tabular-nums]">{adherence.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-inset dark:bg-white/10">
                        <div className="h-full rounded-full bg-primary dark:bg-violet-500" style={{ width: `${adherence.pct}%` }} />
                    </div>
                </button>
            )}

            {/* Histórico recente — cada sessão pré-arma uma análise no composer */}
            {history.length > 0 && (
                <div className="mt-4">
                    <div className={EYEBROW}>Histórico recente</div>
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                        {history.map((h) => (
                            <li key={h.id}>
                                <button
                                    onClick={() => onPrefill(
                                        `Sobre ${firstName}: analise a sessão "${h.text.replace(/ concluído$/, '')}" (${h.dateLabel === 'Hoje' ? 'hoje' : h.dateLabel}). Como foi o desempenho — cargas, RPE, feedback — e o que ajustar para a próxima?`,
                                    )}
                                    className="-mx-1.5 flex w-[calc(100%+12px)] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12.5px] text-k-text-primary transition hover:bg-surface-inset dark:text-foreground dark:hover:bg-glass-bg"
                                >
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C7C7CC] dark:bg-muted-foreground/50" />
                                    <span className="min-w-0 flex-1 truncate">{h.text}</span>
                                    <span className="shrink-0 text-[11px] text-k-text-tertiary dark:text-muted-foreground/60">{h.dateLabel}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Notas do treinador — editáveis inline (F2); readOnly esconde a edição */}
            <NotesSection studentId={student.id} notes={notes} readOnly={data.readOnly} onSaved={onNotesSaved} />

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

/**
 * Notas do treinador com edição inline (F2). Salva via server action
 * updateTrainerNotes (auth + posse + lock no servidor); sucesso atualiza o
 * cache local via onSaved — sem refetch. readOnly (free ex-pagante) só lê.
 */
function NotesSection({ studentId, notes, readOnly, onSaved }: {
    studentId: string
    notes: string | null
    readOnly: boolean
    onSaved: (notes: string | null) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const start = () => { setDraft(notes ?? ''); setError(null); setEditing(true) }
    const save = async () => {
        setSaving(true)
        setError(null)
        try {
            const res = await updateTrainerNotes(studentId, draft.trim())
            if (res.success) {
                onSaved(draft.trim() || null)
                setEditing(false)
            } else {
                setError(res.error ?? 'Não foi possível salvar.')
            }
        } catch {
            setError('Não foi possível salvar.')
        } finally {
            setSaving(false)
        }
    }

    if (!notes && !editing) {
        if (readOnly) return null
        return (
            <button
                onClick={start}
                className="mt-4 flex items-center gap-1.5 text-[11.5px] font-semibold text-k-text-tertiary transition hover:text-k-text-secondary dark:text-muted-foreground/60 dark:hover:text-muted-foreground"
            >
                <Plus className="h-3 w-3" strokeWidth={2.2} />
                Adicionar nota do treinador
            </button>
        )
    }

    return (
        <div className="mt-4">
            <div className="flex items-center gap-1.5">
                <div className={EYEBROW}>Notas do treinador</div>
                {!readOnly && !editing && (
                    <button
                        onClick={start}
                        aria-label="Editar notas do treinador"
                        className="flex h-5 w-5 items-center justify-center rounded text-k-text-quaternary transition hover:bg-surface-inset hover:text-k-text-secondary dark:text-muted-foreground/60 dark:hover:bg-glass-bg"
                    >
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                    </button>
                )}
            </div>
            {editing ? (
                <div className="mt-1.5">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={4}
                        autoFocus
                        disabled={saving}
                        className="w-full resize-none rounded-[12px] border border-k-border-primary bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-k-text-primary outline-none focus:border-primary disabled:opacity-60 dark:border-k-border-primary dark:bg-surface-card dark:text-foreground dark:focus:border-violet-500"
                    />
                    {error && <p className="mt-1 text-[11.5px] text-[#DC2626] dark:text-red-400">{error}</p>}
                    <div className="mt-1.5 flex justify-end gap-2">
                        <button
                            onClick={() => setEditing(false)}
                            disabled={saving}
                            className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-k-text-secondary transition hover:bg-surface-inset disabled:opacity-60 dark:text-muted-foreground dark:hover:bg-glass-bg"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={save}
                            disabled={saving}
                            className="rounded-lg bg-primary px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-600"
                        >
                            {saving ? 'Salvando…' : 'Salvar'}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="mt-1.5 whitespace-pre-wrap rounded-[12px] bg-surface-canvas px-3 py-2.5 text-[12.5px] italic leading-relaxed text-k-text-secondary dark:bg-surface-inset dark:text-muted-foreground">
                    {notes}
                </p>
            )}
        </div>
    )
}

const ACTION_CLS =
    'flex flex-1 flex-col items-center gap-1 rounded-[12px] border border-k-border-subtle bg-white py-2.5 text-[10.5px] font-semibold text-k-text-secondary transition hover:bg-surface-canvas hover:text-k-text-primary dark:border-k-border-subtle dark:bg-surface-card dark:text-muted-foreground dark:hover:bg-glass-bg dark:hover:text-foreground'

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
