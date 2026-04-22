'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, SkipForward } from 'lucide-react'

/* ================================================================== */
/*  Data model                                                          */
/* ================================================================== */

type StudentStatus = 'training' | 'resting'

type SetState = {
    n: number
    prev: string
    weight: string
    reps: string
    done: boolean
}

type ExerciseState = {
    name: string
    badge: 'Aquecimento' | 'Principal' | 'Acessório'
    sets: SetState[]
}

type StudentLive = {
    id: string
    name: string
    avatar: string
    status: StudentStatus
    workoutTitle: string
    exercises: ExerciseState[]
    restSeconds?: number // present iff status === 'resting'
    restTotalSeconds?: number
}

const initialStudents: StudentLive[] = [
    {
        id: 'maria',
        name: 'Maria',
        avatar: 'MS',
        status: 'training',
        workoutTitle: 'Treino A · Superior',
        exercises: [
            {
                name: 'Supino Inclinado com Halteres',
                badge: 'Principal',
                sets: [
                    { n: 1, prev: '12×10', weight: '14', reps: '10', done: true },
                    { n: 2, prev: '12×10', weight: '14', reps: '10', done: true },
                    { n: 3, prev: '12×9', weight: '14', reps: '', done: false },
                    { n: 4, prev: '—', weight: '', reps: '', done: false },
                ],
            },
            {
                name: 'Puxada Aberta na Polia Alta',
                badge: 'Principal',
                sets: [
                    { n: 1, prev: '50×12', weight: '', reps: '', done: false },
                    { n: 2, prev: '50×12', weight: '', reps: '', done: false },
                    { n: 3, prev: '50×10', weight: '', reps: '', done: false },
                ],
            },
        ],
    },
    {
        id: 'joao',
        name: 'João',
        avatar: 'JP',
        status: 'training',
        workoutTitle: 'Treino B · Pernas',
        exercises: [
            {
                name: 'Agachamento Livre',
                badge: 'Principal',
                sets: [
                    { n: 1, prev: '60×8', weight: '60', reps: '8', done: true },
                    { n: 2, prev: '60×8', weight: '60', reps: '8', done: true },
                    { n: 3, prev: '60×8', weight: '', reps: '', done: false },
                ],
            },
            {
                name: 'Cadeira Extensora',
                badge: 'Acessório',
                sets: [
                    { n: 1, prev: '40×12', weight: '', reps: '', done: false },
                    { n: 2, prev: '40×12', weight: '', reps: '', done: false },
                ],
            },
        ],
    },
    {
        id: 'ana',
        name: 'Ana',
        avatar: 'AC',
        status: 'resting',
        workoutTitle: 'Treino A · Superior',
        restSeconds: 48,
        restTotalSeconds: 90,
        exercises: [
            {
                name: 'Remada Curvada',
                badge: 'Principal',
                sets: [
                    { n: 1, prev: '30×10', weight: '32', reps: '10', done: true },
                    { n: 2, prev: '30×10', weight: '32', reps: '10', done: true },
                    { n: 3, prev: '30×10', weight: '', reps: '', done: false },
                ],
            },
        ],
    },
    {
        id: 'pedro',
        name: 'Pedro',
        avatar: 'PL',
        status: 'training',
        workoutTitle: 'Treino C · Braços',
        exercises: [
            {
                name: 'Rosca Direta com Barra',
                badge: 'Principal',
                sets: [
                    { n: 1, prev: '20×12', weight: '20', reps: '12', done: true },
                    { n: 2, prev: '20×12', weight: '20', reps: '', done: false },
                    { n: 3, prev: '20×10', weight: '', reps: '', done: false },
                ],
            },
        ],
    },
    {
        id: 'lucas',
        name: 'Lucas',
        avatar: 'LT',
        status: 'training',
        workoutTitle: 'Treino A · Superior',
        exercises: [
            {
                name: 'Desenvolvimento com Halteres',
                badge: 'Aquecimento',
                sets: [
                    { n: 1, prev: '10×15', weight: '10', reps: '15', done: true },
                    { n: 2, prev: '10×15', weight: '12', reps: '12', done: false },
                ],
            },
        ],
    },
]

const ROTATION_MS = 5000 // auto-advance active student

/* ================================================================== */
/*  Rest timer (floating)                                               */
/* ================================================================== */

function RestTimerOverlay({ secondsLeft, total }: { secondsLeft: number; total: number }) {
    const radius = 26
    const circumference = 2 * Math.PI * radius
    const progress = Math.max(0, Math.min(1, secondsLeft / total))
    const dashOffset = circumference * (1 - progress)
    const mm = Math.floor(secondsLeft / 60)
    const ss = (secondsLeft % 60).toString().padStart(2, '0')

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute bottom-4 right-4 rounded-2xl bg-[#1D1D1F] border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] px-3 py-2.5 flex items-center gap-3"
        >
            <div className="relative w-[60px] h-[60px]">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r={radius} fill="none" stroke="#3A3A3C" strokeWidth="4" />
                    <motion.circle
                        cx="30"
                        cy="30"
                        r={radius}
                        fill="none"
                        stroke="#7C3AED"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset: dashOffset }}
                        transition={{ duration: 0.9, ease: 'linear' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-jakarta text-[12px] font-bold text-white tabular-nums">
                        {mm}:{ss}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <span className="font-jakarta text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                    Descanso
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        className="font-jakarta text-[10px] font-semibold text-white bg-white/10 px-2 py-1 rounded-md hover:bg-white/15 transition-colors"
                    >
                        +15s
                    </button>
                    <button
                        type="button"
                        className="font-jakarta text-[10px] font-semibold text-white/70 px-1.5 py-1 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1"
                    >
                        <SkipForward className="w-2.5 h-2.5" />
                        Pular
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

/* ================================================================== */
/*  Set row                                                             */
/* ================================================================== */

function SetRow({ s }: { s: SetState }) {
    return (
        <div
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                s.done ? 'bg-[#7C3AED]/[0.06]' : ''
            }`}
        >
            <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.done ? 'bg-[#7C3AED]/20 text-[#7C3AED]' : 'bg-[#F2F2F5] text-[#86868B]'
                }`}
            >
                {s.n}
            </div>
            <span className="font-jakarta text-[10px] text-[#AEAEB2] tabular-nums w-12 text-center">
                {s.prev}
            </span>
            <div
                className={`flex-1 text-center rounded-md px-1.5 py-1 font-jakarta text-[11px] font-semibold tabular-nums border ${
                    s.done
                        ? 'bg-[#7C3AED]/[0.08] text-[#7C3AED] border-transparent'
                        : s.weight
                          ? 'bg-white text-[#1D1D1F] border-[#E8E8ED]'
                          : 'bg-[#F5F5F7] text-[#C7C7CC] border-transparent'
                }`}
            >
                {s.weight || 'kg'}
            </div>
            <div
                className={`flex-1 text-center rounded-md px-1.5 py-1 font-jakarta text-[11px] font-semibold tabular-nums border ${
                    s.done
                        ? 'bg-[#7C3AED]/[0.08] text-[#7C3AED] border-transparent'
                        : s.reps
                          ? 'bg-white text-[#1D1D1F] border-[#E8E8ED]'
                          : 'bg-[#F5F5F7] text-[#C7C7CC] border-transparent'
                }`}
            >
                {s.reps || 'reps'}
            </div>
            <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    s.done ? 'bg-[#7C3AED]' : 'border border-[#D2D2D7]'
                }`}
            >
                {s.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Active student panel                                                */
/* ================================================================== */

function StudentPanel({ student }: { student: StudentLive }) {
    return (
        <motion.div
            key={student.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-3"
        >
            {/* Workout header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-jakarta text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                        Treinando agora
                    </p>
                    <p className="font-jakarta text-[15px] font-bold text-[#1D1D1F] mt-0.5">
                        {student.workoutTitle}
                    </p>
                </div>
                <span className="font-jakarta text-[11px] font-semibold text-[#34C759] bg-[#34C759]/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                    Em treino
                </span>
            </div>

            {/* Exercise cards */}
            <div className="space-y-2.5">
                {student.exercises.map((ex, i) => {
                    const completedCount = ex.sets.filter((s) => s.done).length
                    return (
                        <motion.div
                            key={`${student.id}-${ex.name}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            className="bg-white rounded-xl border border-[#E8E8ED] p-3"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-jakarta text-[10px] font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded">
                                    {ex.badge}
                                </span>
                                <p className="font-jakarta text-[12px] font-bold text-[#1D1D1F] truncate flex-1">
                                    {ex.name}
                                </p>
                                <span className="font-jakarta text-[10px] font-semibold text-[#86868B] tabular-nums">
                                    {completedCount}/{ex.sets.length}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {ex.sets.map((s) => (
                                    <SetRow key={s.n} s={s} />
                                ))}
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </motion.div>
    )
}

/* ================================================================== */
/*  Main                                                                */
/* ================================================================== */

export function LandingSalaDeTreino() {
    const [students, setStudents] = useState<StudentLive[]>(initialStudents)
    const [activeId, setActiveId] = useState<string>(initialStudents[0].id)

    // Tick the rest timer every second
    useEffect(() => {
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReduced) return

        const interval = setInterval(() => {
            setStudents((prev) =>
                prev.map((s) => {
                    if (s.status !== 'resting' || s.restSeconds === undefined) return s
                    const next = s.restSeconds - 1
                    if (next <= 0) {
                        return { ...s, restSeconds: s.restTotalSeconds ?? 90 } // loop for the demo
                    }
                    return { ...s, restSeconds: next }
                }),
            )
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    // Auto-rotate active student
    useEffect(() => {
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReduced) return

        const interval = setInterval(() => {
            setActiveId((current) => {
                const idx = students.findIndex((s) => s.id === current)
                const next = students[(idx + 1) % students.length]
                return next.id
            })
        }, ROTATION_MS)
        return () => clearInterval(interval)
    }, [students])

    const activeStudent = students.find((s) => s.id === activeId) ?? students[0]
    const isResting = activeStudent.status === 'resting' && activeStudent.restSeconds !== undefined

    return (
        <section id="sala-de-treino" className="bg-[#F5F5F7] py-24 md:py-32 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7 }}
                    >
                        <span className="inline-flex items-center font-jakarta text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full text-[#7C3AED] bg-[#7C3AED]/10">
                            Sala de Treino
                        </span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7 }}
                        className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-5 leading-[1.1]"
                    >
                        Acompanhe vários alunos na academia,{' '}
                        <span className="text-[#86868B]">sem trocar de tela.</span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7 }}
                        className="font-jakarta text-base md:text-lg text-[#6E6E73] mt-5 max-w-2xl mx-auto leading-relaxed"
                    >
                        Lance carga, repetição e descanso por cada aluno em tempo real. Alterne entre eles em um toque — quem está ativo, quem está descansando, quem precisa de atenção.
                    </motion.p>
                </div>

                {/* Mockup */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, delay: 0.1 }}
                    className="max-w-5xl mx-auto"
                >
                    <div className="relative rounded-2xl bg-white border border-[#E8E8ED] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.18)] overflow-hidden">
                        {/* App header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F2F2F5] bg-[#FBFBFD]">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                                </div>
                                <span className="font-jakarta text-[12px] font-bold text-[#1D1D1F] ml-3">Sala de Treino</span>
                            </div>
                            <button
                                type="button"
                                className="font-jakarta text-[11px] font-semibold text-[#7C3AED] bg-[#7C3AED]/10 hover:bg-[#7C3AED]/15 transition-colors px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" strokeWidth={3} />
                                Adicionar Aluno
                            </button>
                        </div>

                        {/* Student tab strip */}
                        <div className="px-3 pt-3 border-b border-[#F2F2F5]">
                            <div className="flex items-center gap-1 overflow-x-auto pb-3">
                                {students.map((s) => {
                                    const isActive = s.id === activeId
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setActiveId(s.id)}
                                            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 transition-colors ${
                                                isActive ? 'bg-[#1D1D1F]' : 'bg-transparent hover:bg-[#F5F5F7]'
                                            }`}
                                        >
                                            <div
                                                className={`w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center text-white font-jakarta text-[10px] font-bold ${
                                                    isActive ? 'ring-2 ring-white/20' : ''
                                                }`}
                                            >
                                                {s.avatar}
                                            </div>
                                            <span
                                                className={`font-jakarta text-[12px] font-semibold ${
                                                    isActive ? 'text-white' : 'text-[#1D1D1F]'
                                                }`}
                                            >
                                                {s.name}
                                            </span>
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    s.status === 'resting' ? 'bg-[#007AFF]' : 'bg-[#34C759]'
                                                } ${s.status === 'training' ? 'animate-pulse' : ''}`}
                                            />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Active student body */}
                        <div className="relative px-5 py-5 bg-[#FBFBFD] min-h-[420px]">
                            <AnimatePresence mode="wait">
                                <StudentPanel student={activeStudent} />
                            </AnimatePresence>

                            {/* Floating rest timer */}
                            <AnimatePresence>
                                {isResting && activeStudent.restSeconds !== undefined && (
                                    <RestTimerOverlay
                                        secondsLeft={activeStudent.restSeconds}
                                        total={activeStudent.restTotalSeconds ?? 90}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
