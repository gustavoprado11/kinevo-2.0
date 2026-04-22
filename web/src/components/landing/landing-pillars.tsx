'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Check,
    Smartphone,
    GitCompareArrows,
    Sparkles,
    FileText,
    ArrowRight,
    ChevronLeft,
    Search,
    Flame,
    Zap,
    GripVertical,
    Pencil,
} from 'lucide-react'

/* ================================================================== */
/*  MOCK 1 — "Cole e pronto" (AI paste text)                            */
/*  Faithful to ai-prescribe-panel.tsx                                  */
/* ================================================================== */

function PasteMock() {
    return (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#F2F2F5] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
                </div>
                <span className="font-jakarta text-[13px] font-semibold text-[#1D1D1F]">Texto para Treino</span>
            </div>

            <div className="p-5 space-y-4">
                {/* Textarea mock */}
                <div className="relative">
                    <div className="bg-[#FAFAFA] border border-[#E8E8ED] rounded-xl p-4 font-mono text-[12px] text-[#1D1D1F] leading-relaxed min-h-[120px]">
                        <p className="text-[#86868B]">Treino A</p>
                        <p>Supino Inclinado Halter 3x8-10</p>
                        <p>Puxada Aberta 3x10-12</p>
                        <p>Remada Serrote 3x10</p>
                        <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                            className="inline-block w-1.5 h-3.5 bg-[#7C3AED] align-middle ml-0.5"
                        />
                    </div>
                </div>

                {/* Generate button */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full rounded-xl bg-[#7C3AED] text-white flex items-center justify-center gap-2 px-4 py-3"
                >
                    <Sparkles className="w-4 h-4" />
                    <span className="font-jakarta text-[13px] font-semibold">Gerar Treino</span>
                </motion.div>

                {/* Results */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-1.5"
                >
                    <p className="font-jakarta text-[11px] font-semibold text-[#34C759] flex items-center gap-1.5">
                        <Check className="w-3 h-3" strokeWidth={3} />
                        3 exercícios identificados
                    </p>
                    {[
                        { input: 'Supino Inclinado Halter', match: 'Supino Inclinado com Halteres', config: '3 × 8-10' },
                        { input: 'Puxada Aberta', match: 'Puxada Aberta na Polia Alta', config: '3 × 10-12' },
                        { input: 'Remada Serrote', match: 'Remada Unilateral com Halter', config: '3 × 10' },
                    ].map((ex, i) => (
                        <motion.div
                            key={ex.match}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 + i * 0.08 }}
                            className="flex items-center gap-2 py-1.5"
                        >
                            <div className="w-4 h-4 rounded-full bg-[#34C759]/15 flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-[#34C759]" strokeWidth={3} />
                            </div>
                            <span className="font-jakarta text-[12px] text-[#1D1D1F] flex-1 truncate">{ex.match}</span>
                            <span className="font-jakarta text-[11px] text-[#86868B] tabular-nums">{ex.config}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  MOCK 2 — "Visão do aluno" — Builder + live phone preview           */
/*  Faithful to program-builder-client.tsx                              */
/* ================================================================== */

const SCRIPT_EXERCISES = [
    { typed: 'Supino Inclinado', name: 'Supino Inclinado com Halteres', sets: '3', reps: '8-10' },
    { typed: 'Puxada Aberta', name: 'Puxada Aberta na Polia Alta', sets: '3', reps: '10-12' },
    { typed: 'Remada Serrote', name: 'Remada Unilateral com Halter', sets: '3', reps: '10' },
] as const

// Step phases:
//  - typing: cursor types into the search box
//  - landing: card appears in builder + on phone
//  - settle: pause before next exercise
const STEP_DURATIONS_MS = { typing: 1100, landing: 700, settle: 900 }
const TOTAL_STEP_MS = STEP_DURATIONS_MS.typing + STEP_DURATIONS_MS.landing + STEP_DURATIONS_MS.settle
const RESET_DELAY_MS = 1800 // pause at full state before resetting

function useTypewriter(text: string, durationMs: number, active: boolean) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (!active) return
        const stepMs = durationMs / Math.max(text.length, 1)
        const id = setInterval(() => {
            setCount((c) => {
                if (c + 1 >= text.length) clearInterval(id)
                return c + 1
            })
        }, stepMs)
        return () => {
            clearInterval(id)
            setCount(0)
        }
    }, [text, durationMs, active])
    return active ? text.slice(0, count) : ''
}

function StudentViewMock() {
    // step is 0..N-1 = currently animating index of SCRIPT_EXERCISES
    // phase: which sub-step of the current exercise
    const [step, setStep] = useState(0)
    const [phase, setPhase] = useState<'typing' | 'landing' | 'settle'>('typing')
    const [added, setAdded] = useState<number>(0) // how many cards committed so far

    // Drive the loop
    useEffect(() => {
        const total = SCRIPT_EXERCISES.length
        const tTyping = setTimeout(() => setPhase('landing'), STEP_DURATIONS_MS.typing)
        const tLanding = setTimeout(() => {
            setAdded((n) => Math.min(n + 1, total))
            setPhase('settle')
        }, STEP_DURATIONS_MS.typing + STEP_DURATIONS_MS.landing)
        const tNext = setTimeout(() => {
            if (step < total - 1) {
                setStep(step + 1)
                setPhase('typing')
            } else {
                // hold full state briefly, then reset
                const reset = setTimeout(() => {
                    setAdded(0)
                    setStep(0)
                    setPhase('typing')
                }, RESET_DELAY_MS)
                ;(tNext as unknown as { _reset?: ReturnType<typeof setTimeout> })._reset = reset
            }
        }, TOTAL_STEP_MS)
        return () => {
            clearTimeout(tTyping)
            clearTimeout(tLanding)
            clearTimeout(tNext)
            const r = (tNext as unknown as { _reset?: ReturnType<typeof setTimeout> })._reset
            if (r) clearTimeout(r)
        }
    }, [step])

    const current = SCRIPT_EXERCISES[step]
    const typedText = useTypewriter(current.typed, STEP_DURATIONS_MS.typing - 100, phase === 'typing')
    const committedExercises = SCRIPT_EXERCISES.slice(0, added)

    return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-start">
            {/* ============ Builder ============ */}
            <div className="bg-white rounded-2xl border border-[#E8E8ED] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)] overflow-hidden min-w-0">
                {/* Top bar — workout title + day pills */}
                <div className="px-4 py-3 border-b border-[#F2F2F5] flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-jakarta text-[13px] font-bold text-[#1D1D1F] truncate">Treino A</span>
                        <Pencil className="w-3 h-3 text-[#AEAEB2] shrink-0" />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <div
                                key={i}
                                className={`w-5 h-5 rounded-md flex items-center justify-center font-jakarta text-[9px] font-semibold ${
                                    i === 1 || i === 3
                                        ? 'bg-[#7C3AED] text-white'
                                        : 'bg-[#F2F2F5] text-[#86868B]'
                                }`}
                            >
                                {d}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3 bg-[#FBFBFD] min-h-[360px]">
                    {/* Search input — always visible, types during 'typing' */}
                    <div
                        className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border transition-colors ${
                            phase === 'typing'
                                ? 'border-[#7C3AED]/30 ring-2 ring-[#7C3AED]/10'
                                : 'border-[#E8E8ED]'
                        }`}
                    >
                        <Search className="w-3.5 h-3.5 text-[#AEAEB2] shrink-0" />
                        <span className="font-jakarta text-[12px] text-[#1D1D1F] truncate min-w-0 flex-1">
                            {phase === 'typing' && typedText.length > 0 ? (
                                typedText
                            ) : phase === 'typing' ? (
                                <span className="text-[#AEAEB2]">Pesquisar exercício para adicionar...</span>
                            ) : (
                                <span className="text-[#AEAEB2]">Pesquisar exercício para adicionar...</span>
                            )}
                            {phase === 'typing' && (
                                <motion.span
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                                    className="inline-block w-[1.5px] h-3 bg-[#7C3AED] align-middle ml-0.5"
                                />
                            )}
                        </span>
                    </div>

                    {/* Search suggestion popup (only during landing) */}
                    <AnimatePresence>
                        {phase === 'landing' && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="bg-white rounded-lg border border-[#E8E8ED] shadow-sm px-3 py-2 flex items-center gap-2"
                            >
                                <div className="w-5 h-5 rounded-full bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 text-[#7C3AED]" strokeWidth={3} />
                                </div>
                                <span className="font-jakarta text-[11px] text-[#1D1D1F] truncate">
                                    {current.name}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Committed exercise cards */}
                    <div className="space-y-2">
                        <AnimatePresence>
                            {committedExercises.map((ex, i) => (
                                <motion.div
                                    key={`${ex.name}-${i}`}
                                    layout
                                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.35, ease: 'easeOut' }}
                                    className="bg-white rounded-xl border border-[#E8E8ED] p-3 flex items-center gap-2.5"
                                >
                                    <GripVertical className="w-3.5 h-3.5 text-[#C7C7CC] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-jakarta text-[12px] font-bold text-[#1D1D1F] truncate">
                                            {ex.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="font-jakarta text-[10px] text-[#86868B]">
                                                <span className="font-semibold text-[#1D1D1F]">{ex.sets}</span> séries
                                            </span>
                                            <span className="font-jakarta text-[10px] text-[#86868B]">
                                                <span className="font-semibold text-[#1D1D1F]">{ex.reps}</span> reps
                                            </span>
                                        </div>
                                    </div>
                                    <span className="font-jakarta text-[9px] font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded shrink-0">
                                        Principal
                                    </span>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Empty-state chips when nothing yet */}
                        {added === 0 && phase !== 'landing' && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                                {[
                                    { Icon: Flame, label: 'Aquecimento', color: 'text-orange-500', border: 'border-orange-200' },
                                    { Icon: Zap, label: 'Aeróbio', color: 'text-cyan-600', border: 'border-cyan-200' },
                                    { Icon: FileText, label: 'Nota', color: 'text-[#6E6E73]', border: 'border-[#D2D2D7]' },
                                ].map(({ Icon, label, color, border }) => (
                                    <div
                                        key={label}
                                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg border border-dashed ${border} bg-white/40`}
                                    >
                                        <Icon className={`w-4 h-4 ${color}`} />
                                        <span className={`font-jakarta text-[10px] font-semibold ${color}`}>{label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============ Phone preview ============ */}
            <div className="flex justify-center md:justify-start">
                <div className="relative w-[210px] h-[420px] bg-[#1D1D1F] rounded-[36px] p-[8px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)]">
                    <div className="relative w-full h-full bg-white rounded-[28px] overflow-hidden flex flex-col">
                        {/* Status bar */}
                        <div className="h-5 px-5 flex items-center justify-between bg-white shrink-0 relative">
                            <span className="font-jakarta text-[9px] font-semibold text-[#1D1D1F]">09:41</span>
                            <div className="absolute left-1/2 -translate-x-1/2 top-1 w-14 h-3.5 bg-[#1D1D1F] rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-3 py-2.5 border-b border-[#F2F2F5] flex items-center gap-2 shrink-0">
                            <ChevronLeft className="w-3.5 h-3.5 text-[#6E6E73]" />
                            <div className="flex-1 text-center">
                                <p className="font-jakarta text-[11px] font-bold text-[#1D1D1F] leading-tight">Treino A</p>
                                <p className="font-jakarta text-[8px] text-[#86868B] tabular-nums">00:00</p>
                            </div>
                            <div className="w-3.5" />
                        </div>

                        {/* Progress + sets count */}
                        <div className="px-3 pt-2 pb-1.5 shrink-0">
                            <div className="h-0.5 bg-[#F2F2F5] rounded-full overflow-hidden">
                                <motion.div
                                    animate={{ width: `${(added / SCRIPT_EXERCISES.length) * 100}%` }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                    className="h-full bg-[#7C3AED]"
                                />
                            </div>
                            <p className="font-jakarta text-[8px] text-[#86868B] text-right mt-1">
                                <span className="tabular-nums">0/{committedExercises.reduce((acc, e) => acc + Number(e.sets), 0)}</span> séries
                            </p>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-hidden px-2.5 py-2 space-y-1.5 bg-[#FBFBFD]">
                            <AnimatePresence>
                                {committedExercises.length === 0 ? (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex items-center justify-center px-4"
                                    >
                                        <p className="font-jakarta text-[9px] text-[#AEAEB2] text-center leading-snug">
                                            Adicione exercícios para visualizar
                                        </p>
                                    </motion.div>
                                ) : (
                                    committedExercises.map((ex, i) => (
                                        <motion.div
                                            key={`phone-${ex.name}-${i}`}
                                            layout
                                            initial={{ opacity: 0, scale: 0.92, y: 8 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{ duration: 0.4, ease: 'easeOut' }}
                                            className="bg-white rounded-lg border border-[#E8E8ED] p-2"
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                <span className="font-jakarta text-[7px] font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-1 py-0.5 rounded">
                                                    Principal
                                                </span>
                                                <p className="font-jakarta text-[8.5px] font-semibold text-[#1D1D1F] truncate flex-1">
                                                    {ex.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-jakarta text-[7px] text-[#86868B] tabular-nums">
                                                    {ex.sets} × {ex.reps}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Bottom CTA */}
                        <div className="shrink-0 p-2 border-t border-[#F2F2F5] bg-white">
                            <div
                                className={`w-full rounded-lg flex items-center justify-center gap-1 py-2 transition-colors ${
                                    committedExercises.length > 0
                                        ? 'bg-[#7C3AED] text-white'
                                        : 'bg-[#F2F2F5] text-[#AEAEB2]'
                                }`}
                            >
                                <span className="font-jakarta text-[9px] font-semibold">
                                    {committedExercises.length > 0
                                        ? 'Iniciar treino'
                                        : `Finalizar (0/0)`}
                                </span>
                                {committedExercises.length > 0 && <ArrowRight className="w-2.5 h-2.5" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  MOCK 3 — "Compare" (program comparator)                             */
/*  Faithful to past-workout-view.tsx                                   */
/* ================================================================== */

function CompareMock() {
    const rows = [
        { ex: 'Supino Reto', old: '3 × 10', new: '4 × 6-8', diff: 'load' as const, diffLabel: '+1 série' },
        { ex: 'Agachamento Livre', old: '3 × 12', new: '4 × 8-10', diff: 'load' as const, diffLabel: 'volume +' },
        { ex: 'Remada Curvada', old: '3 × 12', new: '—', diff: 'removed' as const, diffLabel: 'trocado' },
        { ex: 'Levantamento Terra', old: '—', new: '4 × 5', diff: 'added' as const, diffLabel: 'novo' },
    ]

    const diffStyles = {
        load: { bg: 'bg-[#34C759]/10', text: 'text-[#34C759]' },
        added: { bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]' },
        removed: { bg: 'bg-[#FF9500]/10', text: 'text-[#FF9500]' },
    }

    return (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)] overflow-hidden">
            {/* Header: two programs */}
            <div className="grid grid-cols-2 border-b border-[#F2F2F5]">
                <div className="px-4 py-3 border-r border-[#F2F2F5]">
                    <p className="font-jakarta text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Anterior</p>
                    <p className="font-jakarta text-[13px] font-semibold text-[#1D1D1F] mt-0.5 truncate">Hipertrofia 3×</p>
                    <p className="font-jakarta text-[10px] text-[#86868B]">8 semanas</p>
                </div>
                <div className="px-4 py-3 bg-[#7C3AED]/[0.04]">
                    <p className="font-jakarta text-[10px] font-semibold text-[#7C3AED] uppercase tracking-wider">Atual</p>
                    <p className="font-jakarta text-[13px] font-semibold text-[#1D1D1F] mt-0.5 truncate">Força & Hipertrofia</p>
                    <p className="font-jakarta text-[10px] text-[#86868B]">4 semanas</p>
                </div>
            </div>

            {/* Section header */}
            <div className="px-4 py-2 bg-[#FAFAFA] border-b border-[#F2F2F5]">
                <p className="font-jakarta text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Principal</p>
            </div>

            {/* Diff rows */}
            <div className="divide-y divide-[#F2F2F5]">
                {rows.map((r, i) => {
                    const style = diffStyles[r.diff]
                    return (
                        <motion.div
                            key={r.ex}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + i * 0.08 }}
                            className="grid grid-cols-[1fr_auto_1fr] items-center"
                        >
                            <div className="px-4 py-3">
                                <p className="font-jakarta text-[12px] font-medium text-[#1D1D1F] truncate">{r.ex}</p>
                                <p className="font-jakarta text-[11px] text-[#86868B] tabular-nums mt-0.5">{r.old}</p>
                            </div>
                            <div className="px-2">
                                <span
                                    className={`inline-flex font-jakarta text-[9px] font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text} whitespace-nowrap`}
                                >
                                    {r.diffLabel}
                                </span>
                            </div>
                            <div className="px-4 py-3 bg-[#7C3AED]/[0.02]">
                                <p className="font-jakarta text-[12px] font-medium text-[#1D1D1F] truncate">
                                    {r.diff === 'removed' ? <span className="text-[#AEAEB2] line-through">{r.ex}</span> : r.ex}
                                </p>
                                <p className="font-jakarta text-[11px] text-[#7C3AED] tabular-nums font-semibold mt-0.5">{r.new}</p>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Footer summary */}
            <div className="px-4 py-3 border-t border-[#F2F2F5] bg-[#FAFAFA] flex items-center justify-between">
                <p className="font-jakarta text-[11px] text-[#6E6E73]">
                    <span className="font-semibold text-[#1D1D1F]">Volume semanal</span> +18%
                </p>
                <span className="font-jakarta text-[10px] font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-1 rounded-md">
                    Aplicar mudanças
                </span>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Pillars — 3 facets of Prescrição promoted to top-level              */
/* ================================================================== */

interface Pillar {
    id: 'paste' | 'student' | 'compare'
    icon: typeof Sparkles
    label: string
    eyebrow: string
    title: string
    description: string
    mock: React.ReactNode
}

const pillars: Pillar[] = [
    {
        id: 'paste',
        icon: Sparkles,
        label: 'Cole e pronto',
        eyebrow: 'IMPORTAR',
        title: 'Cole seu treino. O resto é com a gente.',
        description:
            'A IA reconhece os exercícios em qualquer formato e monta o programa pronto pra editar.',
        mock: <PasteMock />,
    },
    {
        id: 'student',
        icon: Smartphone,
        label: 'Visão do aluno',
        eyebrow: 'PREVIEW EM TEMPO REAL',
        title: 'Veja o treino nascer no app, exercício por exercício.',
        description:
            'Enquanto você prescreve o treino, veja como seu aluno irá receber o treino no app.',
        mock: <StudentViewMock />,
    },
    {
        id: 'compare',
        icon: GitCompareArrows,
        label: 'Compare',
        eyebrow: 'EVOLUÇÃO DO PROGRAMA',
        title: 'Veja exatamente o que mudou.',
        description:
            'Comparativo lado a lado entre o ciclo antigo e o novo: o que entrou, o que saiu, onde subiu o volume.',
        mock: <CompareMock />,
    },
]

/* ================================================================== */
/*  Main                                                                */
/* ================================================================== */

export function LandingPillars() {
    const [activeTab, setActiveTab] = useState(0)
    const activePillar = pillars[activeTab]

    return (
        <section className="bg-[#F5F5F7] py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
                        Tudo que você precisa para{' '}
                        <span className="text-[#86868B]">prescrever treinos de forma eficiente.</span>
                    </h2>
                </motion.div>

                {/* Tab navigation */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className="mt-12 flex justify-center"
                >
                    <div className="inline-flex items-center bg-white rounded-full p-1.5 border border-[#E8E8ED] shadow-sm">
                        {pillars.map((pillar, i) => {
                            const isActive = activeTab === i
                            return (
                                <button
                                    key={pillar.id}
                                    onClick={() => setActiveTab(i)}
                                    className={`relative flex items-center gap-2 font-jakarta text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 ${
                                        isActive ? 'text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                                    }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="pillar-tab-bg"
                                            className="absolute inset-0 rounded-full bg-[#1D1D1F]"
                                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative flex items-center gap-2">
                                        <pillar.icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{pillar.label}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </motion.div>

                {/* Tab content */}
                <div className="mt-12 md:mt-16">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePillar.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20"
                        >
                            {/* Text */}
                            <div className="flex-1">
                                <span className="inline-flex items-center gap-1.5 font-jakarta text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full text-[#7C3AED] bg-[#7C3AED]/10">
                                    {activePillar.eyebrow}
                                </span>

                                <h3 className="font-jakarta text-2xl md:text-3xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                                    {activePillar.title}
                                </h3>

                                <p className="font-jakarta text-[#6E6E73] text-base leading-relaxed mt-4">
                                    {activePillar.description}
                                </p>
                            </div>

                            {/* Visual */}
                            <div className="flex-1 w-full">{activePillar.mock}</div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
