'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Wand2, Check, RefreshCw, Trash2 } from 'lucide-react'
import type { PrescriptionStyle } from '@kinevo/shared/types/prescription'
import { deletePrescriptionStyle } from '@/actions/trainer/update-prescription-style'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'

interface Props {
    style: PrescriptionStyle | null
}

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
    Object.entries(SYSTEM_PRESETS).map(([key, preset]) => [key, preset.name]),
)

function range(r: { min: number; max: number } | null, unit = ''): string | null {
    if (!r) return null
    return r.min === r.max ? `${r.min}${unit}` : `${r.min}–${r.max}${unit}`
}

/** As linhas do resumo — só o que o treinador de fato definiu. */
function summarize(style: PrescriptionStyle): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = []

    const splits = Object.entries(style.splits_by_frequency)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([freq, label]) => `${freq}x/sem: ${label}`)
    if (splits.length > 0) rows.push({ label: 'Divisão', value: splits.join(' · ') })

    const reps = [
        style.reps_compound && `compostos ${style.reps_compound}`,
        style.reps_accessory && `acessórios ${style.reps_accessory}`,
    ].filter(Boolean)
    if (reps.length > 0) rows.push({ label: 'Repetições', value: reps.join(', ') })

    const rest = [
        range(style.rest_compound_seconds, 's') && `compostos ${range(style.rest_compound_seconds, 's')}`,
        range(style.rest_accessory_seconds, 's') && `acessórios ${range(style.rest_accessory_seconds, 's')}`,
    ].filter(Boolean)
    if (rest.length > 0) rows.push({ label: 'Descanso', value: rest.join(', ') })

    const volume = [
        range(style.weekly_sets_emphasized) && `enfatizado ${range(style.weekly_sets_emphasized)}`,
        range(style.weekly_sets_principal) && `principal ${range(style.weekly_sets_principal)}`,
        range(style.weekly_sets_small) && `pequeno ${range(style.weekly_sets_small)}`,
    ].filter(Boolean)
    if (volume.length > 0) rows.push({ label: 'Volume semanal', value: volume.join(', ') })

    const perSession = range(style.exercises_per_session)
    if (perSession) rows.push({ label: 'Exercícios por sessão', value: perSession })

    if (style.methods_used.length > 0) {
        rows.push({
            label: 'Métodos',
            value: style.methods_used.map((m) => METHOD_LABELS[m] ?? m).join(', '),
        })
    }
    if (style.superset_usage) rows.push({ label: 'Supersets', value: `uso ${style.superset_usage}` })

    if (style.favorite_exercises.length > 0) {
        rows.push({
            label: 'Favoritos',
            value: style.favorite_exercises
                .map((f) => `${f.group}: ${f.names.slice(0, 3).join(', ')}`)
                .join(' · '),
        })
    }

    if (style.progression) rows.push({ label: 'Progressão', value: style.progression })
    if (style.warmup) rows.push({ label: 'Aquecimento', value: style.warmup })
    if (style.equipment_notes) rows.push({ label: 'Equipamento', value: style.equipment_notes })
    if (style.special_populations) rows.push({ label: 'Públicos especiais', value: style.special_populations })
    if (style.notes) rows.push({ label: 'Observações', value: style.notes })

    return rows
}

/**
 * "Meu estilo de prescrição" — o que o Assistente aprendeu sobre como este
 * treinador monta treino, em português, com as ações de refazer e apagar.
 */
export function PrescriptionStyleSection({ style }: Props) {
    const [removed, setRemoved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const active = style && !removed

    const handleDelete = () => {
        if (!confirm('Remover o seu estilo? O Assistente volta a montar treinos com os padrões dele.')) return
        setError(null)
        startTransition(async () => {
            const result = await deletePrescriptionStyle()
            if (!result.success) setError(result.message ?? 'Não foi possível remover o estilo.')
            else setRemoved(true)
        })
    }

    return (
        <div className="bg-surface-card border border-k-border-primary rounded-2xl p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-k-text-primary">Estilo de prescrição</h2>
                    <p className="text-sm text-k-text-tertiary mt-1">
                        Como o Assistente monta treino quando é você quem pede.
                    </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Wand2 size={18} strokeWidth={1.5} />
                </div>
            </div>

            {!active ? (
                <div className="rounded-xl border border-k-border-subtle bg-surface-inset p-4">
                    <p className="text-sm text-k-text-secondary leading-relaxed">
                        Você ainda não ensinou o seu estilo. O Assistente lê os programas que você já montou,
                        pergunta só o que falta e passa a prescrever do seu jeito — divisão, repetições,
                        descansos, métodos e exercícios preferidos.
                    </p>
                    <Link
                        href="/assistente?estilo=1"
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
                    >
                        <Wand2 size={15} />
                        Ensinar meu estilo
                    </Link>
                </div>
            ) : (
                <>
                    <div className="flex flex-col divide-y divide-k-border-subtle rounded-xl border border-k-border-subtle bg-surface-inset">
                        {summarize(style).map((row) => (
                            <div key={row.label} className="flex gap-4 px-4 py-3">
                                <span className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wider text-k-text-quaternary">
                                    {row.label}
                                </span>
                                <span className="text-sm text-k-text-primary">{row.value}</span>
                            </div>
                        ))}
                    </div>

                    <p className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-k-text-quaternary">
                        <Check size={12} strokeWidth={3} className="text-emerald-500" />
                        Aplicado nos programas que o Assistente monta
                        {style.mined
                            ? ` — ${style.mined.programs_analyzed} programas seus foram analisados`
                            : ''}
                        .
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href="/assistente?estilo=1"
                            className="inline-flex items-center gap-2 rounded-full border border-k-border-primary px-4 py-2 text-sm font-semibold text-k-text-primary transition-colors hover:bg-surface-inset"
                        >
                            <RefreshCw size={14} />
                            Refazer com meus programas atuais
                        </Link>
                        <button
                            onClick={handleDelete}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 rounded-full border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
                        >
                            <Trash2 size={14} />
                            {isPending ? 'Removendo…' : 'Remover estilo'}
                        </button>
                    </div>
                </>
            )}

            {error && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                    {error}
                </div>
            )}
        </div>
    )
}
