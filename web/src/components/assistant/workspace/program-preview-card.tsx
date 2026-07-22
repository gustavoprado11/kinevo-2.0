'use client'

/**
 * Prévia de programa (preview-first, 22/jul) — três apresentações da MESMA part
 * `confirmation` pendente de kinevo_create_student_draft_program:
 *
 *   - ProgramPreviewCard   → card completo no chat (dock e telas sem a 3ª coluna);
 *   - ProgramPreviewCanvas → o "documento vivo" no painel de contexto (V2):
 *     conversa à esquerda, programa em revisão à direita, atualizado a cada
 *     iteração ("troca X por Y" → nova prévia → o canvas troca de versão);
 *   - ProgramPreviewChip   → chip compacto no chat quando o canvas está visível
 *     (aponta para o painel em vez de duplicar a estrutura).
 *
 * Nada existe até o treinador decidir: Salvar rascunho → execute-tool cria o
 * draft; Ativar agora (2º clique) → cria e ativa em seguida; Descartar → nada.
 * Edição estrutural continua no builder (única superfície de edição de programa).
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, X, Zap, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AssistantMark } from '@/components/assistant/assistant-mark'
import type { ToolConfirmationRequest } from '@/lib/assistant/hitl-types'
import type { AiSurface } from '@/lib/ai-usage/metering'

// ── Tipos do payload (espelho defensivo do schema da tool MCP) ──

interface SetScheme {
    set_type?: string
    reps?: string
    rest_seconds?: number
    weight_target_kg?: number | null
    weight_target_pct1rm?: number | null
}

interface SupersetChild {
    exercise_id: string
    sets?: number
    reps?: string
}

interface CardioConfig {
    mode?: string
    equipment?: string
    duration_minutes?: number
    distance_km?: number
    intervals?: { work_seconds?: number; rest_seconds?: number; rounds?: number }
    segments?: unknown[]
    intensity_target?: { type?: string; zone?: number; rpe?: number; hr_min_bpm?: number; hr_max_bpm?: number; pace_min_per_km?: string | number }
    protocol_key?: string
}

interface PreviewItem {
    exercise_id?: string
    sets?: number
    reps?: string
    rest_seconds?: number
    method_key?: string
    set_scheme?: SetScheme[]
    rounds?: number
    superset?: SupersetChild[]
    cardio?: CardioConfig
}

interface PreviewSession {
    name?: string
    scheduled_days?: number[]
    session_type?: string
    items?: PreviewItem[]
}

export interface PreviewPayload {
    student_id?: string
    name?: string
    description?: string
    duration_weeks?: number
    sessions?: PreviewSession[]
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const METHOD_LABELS: Record<string, string> = {
    pyramid_down: 'Pirâmide desc.',
    pyramid_up: 'Pirâmide cresc.',
    drop_set: 'Drop-set',
    top_backoff: 'Top + backoff',
    '5x5': '5×5',
    cluster: 'Cluster',
}

const EQUIPMENT_LABELS: Record<string, string> = {
    treadmill: 'Esteira',
    bike: 'Bike',
    elliptical: 'Elíptico',
    rower: 'Remo',
    stairmaster: 'Escada',
    jump_rope: 'Corda',
    outdoor_run: 'Corrida (rua)',
    outdoor_bike: 'Pedal (rua)',
    swimming: 'Natação',
    other: 'Outro',
}

/** "4×10 · 90s" (simples) ou "12/10/8 · Pirâmide desc." (set_scheme). */
function prescriptionOf(item: PreviewItem): string {
    if (item.set_scheme && item.set_scheme.length > 0) {
        const reps = item.set_scheme.map((s) => s.reps ?? '?').join('/')
        const rounds = item.rounds && item.rounds > 1 ? ` ×${item.rounds}` : ''
        const method = item.method_key ? METHOD_LABELS[item.method_key] : null
        return `${reps}${rounds}${method ? ` · ${method}` : ''}`
    }
    const sets = item.sets ?? 3
    const reps = item.reps ?? '10'
    const rest = item.rest_seconds != null ? ` · ${item.rest_seconds}s` : ''
    return `${sets}×${reps}${rest}`
}

function intensityOf(t: CardioConfig['intensity_target']): string | null {
    if (!t) return null
    if (t.type === 'zone' && t.zone) return `Z${t.zone}`
    if (t.type === 'rpe' && t.rpe) return `RPE ${t.rpe}`
    if (t.type === 'hr' && t.hr_min_bpm) return `${t.hr_min_bpm}–${t.hr_max_bpm ?? '?'} bpm`
    if (t.type === 'pace' && t.pace_min_per_km) return `${t.pace_min_per_km}/km`
    return null
}

function cardioLabel(c: CardioConfig): string {
    const bits: string[] = []
    if (c.equipment) bits.push(EQUIPMENT_LABELS[c.equipment] ?? c.equipment)
    if (c.mode === 'interval' && c.intervals) {
        bits.push(`${c.intervals.work_seconds ?? '?'}s/${c.intervals.rest_seconds ?? '?'}s ×${c.intervals.rounds ?? '?'}`)
    } else if (c.mode === 'phased' && Array.isArray(c.segments)) {
        bits.push(`${c.segments.length} fases`)
    } else {
        if (c.duration_minutes) bits.push(`${c.duration_minutes} min`)
        if (c.distance_km) bits.push(`${c.distance_km} km`)
    }
    const intensity = intensityOf(c.intensity_target)
    if (intensity) bits.push(intensity)
    return bits.join(' · ') || 'bloco aeróbio'
}

/** Ids de exercício referenciados no payload (itens + filhos de superset). */
function collectExerciseIds(payload: PreviewPayload): string[] {
    const ids = new Set<string>()
    for (const s of payload.sessions ?? []) {
        for (const it of s.items ?? []) {
            if (it.cardio) continue
            if (it.superset) for (const c of it.superset) ids.add(c.exercise_id)
            else if (it.exercise_id) ids.add(it.exercise_id)
        }
    }
    return Array.from(ids)
}

/**
 * Executa uma CONFIRM_TOOL via /api/assistant/execute-tool (mesmo contrato do
 * ToolConfirmationCard). Lança Error com a mensagem legível em falha.
 * Compartilhado com o "Ativar agora" do card de rascunho (conversation-view).
 */
export async function executeAssistantToolClient(
    toolName: string,
    args: unknown,
    surface: AiSurface,
    idempotencyKey: string,
): Promise<unknown> {
    const res = await fetch('/api/assistant/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, args, surface, idempotencyKey }),
    })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
        const msg = (data as { message?: string; error?: string })?.message
            ?? (data as { error?: string })?.error ?? 'Não foi possível executar a ação.'
        throw new Error(msg)
    }
    return (data as { result?: unknown })?.result
}

/** Payload útil de um resultado MCP ({content:[{text:'<json>'}]}). */
function parseResult(result: unknown): Record<string, unknown> | null {
    const content = (result as { content?: Array<{ text?: string }> } | null)?.content
    if (Array.isArray(content) && typeof content[0]?.text === 'string') {
        try { return JSON.parse(content[0].text) as Record<string, unknown> } catch { return null }
    }
    return null
}

/** Embrulha um payload já parseado de volta no envelope MCP (p/ persistir na part). */
function wrapResult(payload: Record<string, unknown>): unknown {
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

// ── Nomes dos exercícios: o payload carrega só os ids (a tool resolve o
// snapshot na criação) — a prévia resolve via client com RLS. ──
function useExerciseNames(payload: PreviewPayload): (id?: string) => string {
    const [names, setNames] = useState<Record<string, string>>({})
    const exerciseIds = useMemo(() => collectExerciseIds(payload), [payload])
    useEffect(() => {
        if (exerciseIds.length === 0) return
        let cancelled = false
        const supabase = createClient()
        supabase
            .from('exercises')
            .select('id, name')
            .in('id', exerciseIds)
            .then(({ data }) => {
                if (cancelled || !data) return
                const map: Record<string, string> = {}
                for (const e of data as Array<{ id: string; name: string }>) map[e.id] = e.name
                setNames(map)
            })
        return () => { cancelled = true }
    }, [exerciseIds])
    return (id?: string) => (id ? names[id] ?? 'Exercício' : 'Exercício')
}

type Phase =
    | { kind: 'idle' }
    | { kind: 'running'; action: 'save' | 'activate' }
    | { kind: 'saved' }
    | { kind: 'activated' }
    | { kind: 'discarded' }

/**
 * Máquina de estados das ações da prévia (compartilhada card ⇄ canvas):
 * salvar = create; ativar = create → assign activate_draft encadeados, com o
 * resultado combinado (`activated`) numa part só. Falha na ativação após o
 * create resolve como salvo (com `activation_failed` p/ o desfecho explicar).
 */
function usePreviewExecution({ request, surface, onResolved }: {
    request: ToolConfirmationRequest
    surface: AiSurface
    onResolved: (confirmed: boolean, result?: unknown) => void
}) {
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
    const [armActivate, setArmActivate] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const execTool = (toolName: string, args: unknown, idempotencyKey: string) =>
        executeAssistantToolClient(toolName, args, surface, idempotencyKey)

    const saveDraft = async (): Promise<unknown | null> => {
        try {
            return await execTool('kinevo_create_student_draft_program', request.args, request.idempotencyKey ?? crypto.randomUUID())
        } catch (e) {
            setErrorMsg((e as Error).message)
            setPhase({ kind: 'idle' })
            return null
        }
    }

    const onSave = async () => {
        setPhase({ kind: 'running', action: 'save' })
        setErrorMsg(null)
        const result = await saveDraft()
        if (result === null) return
        setPhase({ kind: 'saved' })
        onResolved(true, result)
    }

    const onActivate = async () => {
        setPhase({ kind: 'running', action: 'activate' })
        setErrorMsg(null)
        const created = await saveDraft()
        if (created === null) return
        const createdPayload = parseResult(created)
        const programId = (createdPayload?.program as { id?: string } | undefined)?.id
        if (!programId) {
            setErrorMsg('O rascunho foi salvo, mas não consegui ativar automaticamente — ative pelo builder.')
            setPhase({ kind: 'saved' })
            onResolved(true, created)
            return
        }
        try {
            const activation = await execTool(
                'kinevo_assign_program',
                { program_id: programId, action: 'activate_draft' },
                crypto.randomUUID(),
            )
            const activationPayload = parseResult(activation)
            setPhase({ kind: 'activated' })
            onResolved(true, wrapResult({
                ...(createdPayload ?? {}),
                activated: true,
                assigned_program: activationPayload?.assigned_program ?? null,
                message: (activationPayload?.message as string | undefined) ?? 'Programa ativado.',
            }))
        } catch (e) {
            setErrorMsg(`O rascunho foi salvo, mas a ativação falhou: ${(e as Error).message}`)
            setPhase({ kind: 'saved' })
            onResolved(true, wrapResult({ ...(createdPayload ?? {}), activation_failed: true }))
        }
    }

    const onDiscard = () => {
        setPhase({ kind: 'discarded' })
        onResolved(false)
    }

    return { phase, errorMsg, armActivate, setArmActivate, onSave, onActivate, onDiscard }
}

/** Lista de sessões da prévia — o corpo compartilhado card ⇄ canvas. */
function PreviewSessions({ sessions, nameOf, dense }: {
    sessions: PreviewSession[]
    nameOf: (id?: string) => string
    dense?: boolean
}) {
    const pad = dense ? 'px-3 py-2.5' : 'px-4 py-3'
    return (
        <div className="divide-y divide-k-border-subtle">
            {sessions.map((s, si) => (
                <div key={si} className={pad}>
                    <div className="flex items-baseline gap-2.5">
                        <b className={`min-w-0 flex-1 truncate font-semibold text-k-text-primary ${dense ? 'text-[12.5px]' : 'text-[13px]'}`}>{s.name ?? `Treino ${si + 1}`}</b>
                        <span className="shrink-0 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">
                            {(s.scheduled_days ?? []).map((d) => DAY_LABELS[d] ?? '?').join(' · ') || 'sem dia'}
                        </span>
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-[3px]">
                        {(s.items ?? []).map((it, ii) => {
                            if (it.cardio) {
                                return (
                                    <li key={ii} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                                        <span className="min-w-0 truncate text-k-text-primary">Aeróbio</span>
                                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-k-text-secondary">{cardioLabel(it.cardio)}</span>
                                    </li>
                                )
                            }
                            if (it.superset) {
                                return (
                                    <li key={ii} className="text-[12.5px]">
                                        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Superset</span>
                                        <ul className="mt-[2px] flex flex-col gap-[3px] border-l-2 border-k-border-subtle pl-2.5">
                                            {it.superset.map((c, ci) => (
                                                <li key={ci} className="flex items-baseline justify-between gap-3">
                                                    <span className="min-w-0 truncate text-k-text-primary">{nameOf(c.exercise_id)}</span>
                                                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-k-text-secondary">{c.sets ?? '?'}×{c.reps ?? '?'}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                )
                            }
                            return (
                                <li key={ii} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                                    <span className="min-w-0 truncate text-k-text-primary">{nameOf(it.exercise_id)}</span>
                                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-k-text-secondary">{prescriptionOf(it)}</span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            ))}
        </div>
    )
}

/** Linha de ações (Salvar / Ativar 2-clique / Descartar) + dica/erro. */
function PreviewActions({ exec, disabled }: {
    exec: ReturnType<typeof usePreviewExecution>
    disabled?: boolean
}) {
    const { phase, errorMsg, armActivate, setArmActivate, onSave, onActivate, onDiscard } = exec
    const running = phase.kind === 'running'
    const off = running || disabled
    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={onSave}
                    disabled={off}
                    className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-[7px] text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                    {running && phase.action === 'save'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
                        : <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
                    Salvar rascunho
                </button>
                {armActivate ? (
                    <button
                        onClick={onActivate}
                        disabled={off}
                        className="inline-flex items-center gap-1.5 rounded-control bg-amber-600 px-3.5 py-[7px] text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-amber-500 dark:text-stone-950"
                    >
                        {running && phase.action === 'activate'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
                            : <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />}
                        Confirmar ativação
                    </button>
                ) : (
                    <button
                        onClick={() => setArmActivate(true)}
                        disabled={off}
                        className="inline-flex items-center gap-1.5 rounded-control border border-k-border-subtle px-3.5 py-[7px] text-[12.5px] font-semibold text-k-text-secondary transition hover:bg-surface-inset hover:text-k-text-primary disabled:opacity-50"
                    >
                        <Zap className="h-3.5 w-3.5" strokeWidth={2} /> Ativar agora
                    </button>
                )}
                <button
                    onClick={onDiscard}
                    disabled={off}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-control px-2.5 py-[7px] text-[12px] font-medium text-k-text-tertiary transition hover:bg-surface-inset hover:text-k-text-secondary disabled:opacity-50"
                >
                    <X className="h-3.5 w-3.5" strokeWidth={2.2} /> Descartar
                </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-k-text-quaternary">
                {armActivate
                    ? 'Ativar cria o programa e o coloca no app do aluno na hora (o vigente, se houver, é concluído).'
                    : 'Quer ajustar algo? Responda na conversa (ex.: “troca o stiff por RDL”) que eu refaço a prévia.'}
            </p>
            {errorMsg && <p className="mt-1.5 text-[12px] font-medium text-rose-600 dark:text-rose-400">{errorMsg}</p>}
        </>
    )
}

/** Pill compacta dos estados finais (salvo/ativado/descartado). */
function PreviewDonePill({ phase, errorMsg }: { phase: Phase; errorMsg: string | null }) {
    if (phase.kind === 'discarded') {
        return (
            <div className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface-inset px-3 py-1.5 text-[12px] text-k-text-tertiary">
                Prévia descartada
            </div>
        )
    }
    return (
        <div className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface-inset px-3 py-1.5 text-[12px] text-k-text-tertiary">
            <Check className="h-[13px] w-[13px] text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} />
            {phase.kind === 'activated' ? 'Programa criado e ativado' : 'Rascunho salvo'}
            {errorMsg && <span className="text-amber-600 dark:text-amber-400">· {errorMsg}</span>}
        </div>
    )
}

interface CardProps {
    request: ToolConfirmationRequest
    /** Card antigo (a conversa avançou / nova prévia emitida) vira read-only. */
    interactive: boolean
    surface?: AiSurface
    /** Mesmo contrato do ToolConfirmationCard → onConfirmResolved da thread. */
    onResolved: (confirmed: boolean, result?: unknown) => void
}

/** Card completo no chat (dock / telas sem a 3ª coluna). */
export function ProgramPreviewCard({ request, interactive, surface = 'workspace', onResolved }: CardProps) {
    const payload = request.args as PreviewPayload
    const sessions = payload.sessions ?? []
    const exec = usePreviewExecution({ request, surface, onResolved })
    const nameOf = useExerciseNames(payload)

    if (exec.phase.kind === 'saved' || exec.phase.kind === 'activated' || exec.phase.kind === 'discarded') {
        return <PreviewDonePill phase={exec.phase} errorMsg={exec.errorMsg} />
    }

    // Prévia antiga (nova versão emitida / conversa avançou): resumo quieto.
    if (!interactive) {
        return (
            <div className="mt-3 max-w-[540px] rounded-panel border border-k-border-subtle bg-surface-inset/60 p-3.5 opacity-70">
                <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">Prévia anterior — substituída</span>
                <b className="mt-0.5 block truncate text-[13px] font-semibold text-k-text-secondary">{payload.name ?? 'Programa'}</b>
            </div>
        )
    }

    return (
        <div className="mt-3 max-w-[560px] rounded-panel border border-k-border-subtle bg-surface-card">
            <div className="flex items-center gap-3 border-b border-k-border-subtle px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary">
                    <AssistantMark className="h-4 w-4 text-primary-foreground" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                    <b className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-k-text-primary">{payload.name ?? 'Programa'}</b>
                    <span className="mt-0.5 block font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                        Prévia — nada foi criado ainda
                    </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-k-text-tertiary">
                    {sessions.length} treino{sessions.length === 1 ? '' : 's'}{payload.duration_weeks ? ` · ${payload.duration_weeks} sem` : ''}
                </span>
            </div>
            <PreviewSessions sessions={sessions} nameOf={nameOf} />
            <div className="border-t border-k-border-subtle px-4 py-3">
                <PreviewActions exec={exec} />
            </div>
        </div>
    )
}

/**
 * Canvas no painel de contexto (V2) — o programa em revisão como documento
 * vivo ao lado da conversa. Mesmo payload/ações do card; largura do painel.
 */
export function ProgramPreviewCanvas({ request, version, disabled, onResolved }: {
    request: ToolConfirmationRequest
    /** nº da prévia na conversa (v1, v2… — cada iteração emite uma nova). */
    version: number
    /** Turno em andamento: uma nova versão pode estar chegando. */
    disabled?: boolean
    onResolved: (confirmed: boolean, result?: unknown) => void
}) {
    const payload = request.args as PreviewPayload
    const sessions = payload.sessions ?? []
    const exec = usePreviewExecution({ request, surface: 'workspace', onResolved })
    const nameOf = useExerciseNames(payload)

    // Estados finais: o card do aluno reassume o painel (a part resolvida some
    // da derivação no workspace); aqui só o eco imediato pós-clique.
    if (exec.phase.kind === 'saved' || exec.phase.kind === 'activated' || exec.phase.kind === 'discarded') {
        return (
            <div className="mb-3 rounded-panel border border-k-border-subtle bg-surface-card p-3.5">
                <PreviewDonePill phase={exec.phase} errorMsg={exec.errorMsg} />
            </div>
        )
    }

    return (
        <div className="mb-3 overflow-hidden rounded-panel border border-k-border-subtle bg-surface-card">
            <div className="flex items-center gap-2.5 border-b border-k-border-subtle px-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary">
                    <AssistantMark className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-k-text-primary">{payload.name ?? 'Programa'}</b>
                    <span className="mt-0.5 block font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                        Prévia v{version} — nada criado
                    </span>
                </div>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-k-text-tertiary">
                    {sessions.length}t{payload.duration_weeks ? ` · ${payload.duration_weeks}sem` : ''}
                </span>
            </div>
            <PreviewSessions sessions={sessions} nameOf={nameOf} dense />
            <div className="border-t border-k-border-subtle px-3 py-2.5">
                <PreviewActions exec={exec} disabled={disabled} />
            </div>
        </div>
    )
}

/**
 * Chip compacto no chat quando o canvas está visível no painel — aponta para o
 * documento em vez de duplicar a estrutura na thread.
 */
export function ProgramPreviewChip({ request, version, onOpen }: {
    request: ToolConfirmationRequest
    version: number
    onOpen: () => void
}) {
    const payload = request.args as PreviewPayload
    const sessions = payload.sessions ?? []
    return (
        <button
            onClick={onOpen}
            className="mt-3 flex w-full max-w-[440px] items-center gap-3 rounded-panel border border-k-border-subtle bg-surface-card p-3.5 text-left transition hover:bg-surface-inset/60"
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary">
                <AssistantMark className="h-4 w-4 text-primary-foreground" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-k-text-primary">{payload.name ?? 'Programa'}</b>
                <span className="mt-0.5 block font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                    Prévia v{version} · {sessions.length} treino{sessions.length === 1 ? '' : 's'}{payload.duration_weeks ? ` · ${payload.duration_weeks} sem` : ''}
                </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary">
                Revisar no painel <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
        </button>
    )
}
