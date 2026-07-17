'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { matchesSearch } from '@kinevo/shared/utils/search-text'
import {
    AlertCircle,
    Calendar as CalendarIcon,
    Check,
    Clock,
    Loader2,
    Plus,
    Repeat,
    Search,
    Trash2,
    X,
} from 'lucide-react'
import { createRecurringAppointment } from '@/actions/appointments/create-recurring'
import { createRecurringAppointmentGroup } from '@/actions/appointments/create-recurring-group'

type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly'

interface Slot {
    id: string
    dayOfWeek: number
    startTime: string
    durationMinutes: number
    customDuration: string
}

interface StudentOption {
    id: string
    name: string
    avatarUrl: string | null
}

interface Props {
    isOpen: boolean
    onClose: () => void
    preselectedStudentId?: string
    preselectedStudentName?: string
    preselectedDate?: string
    preselectedTime?: string
    /**
     * Lista de alunos pro autocomplete no fluxo standalone (sem
     * `preselectedStudentId`). Ignorada quando `preselectedStudentId` está
     * presente. Se ausente em fluxo standalone, mostra estado "nenhum aluno".
     */
    students?: StudentOption[]
    onSuccess?: (result: { recurringId?: string; groupId?: string }) => void
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] // index = dia da semana (0=Dom)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // ordem de exibição: segunda → domingo
const DURATION_CHIPS = [45, 60, 90] as const
const MAX_SLOTS = 7

function toDateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function dayOfWeekFromKey(key: string): number {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).getDay()
}

function nextOccurrenceDate(fromKey: string, dow: number): string {
    const [y, m, d] = fromKey.split('-').map(Number)
    const cursor = new Date(y, m - 1, d)
    const delta = (dow - cursor.getDay() + 7) % 7
    cursor.setDate(cursor.getDate() + delta)
    return toDateKey(cursor)
}

function newSlotId(): string {
    return `slot-${Math.random().toString(36).slice(2, 10)}`
}

function resolveDuration(slot: Slot): number {
    if (slot.customDuration) {
        const n = Number(slot.customDuration)
        if (Number.isFinite(n) && n >= 15 && n <= 240) return n
    }
    return slot.durationMinutes
}

export function CreateAppointmentModal({
    isOpen,
    onClose,
    preselectedStudentId,
    preselectedStudentName,
    preselectedDate,
    preselectedTime,
    students,
    onSuccess,
}: Props) {
    const todayKey = useMemo(() => toDateKey(new Date()), [])

    const makeInitialSlot = (dow: number, time: string): Slot => ({
        id: newSlotId(),
        dayOfWeek: dow,
        startTime: time,
        durationMinutes: 60,
        customDuration: '',
    })

    const [slots, setSlots] = useState<Slot[]>(() => [
        makeInitialSlot(
            preselectedDate ? dayOfWeekFromKey(preselectedDate) : 2,
            preselectedTime ?? '07:00',
        ),
    ])
    const [frequency, setFrequency] = useState<Frequency>('weekly')
    const [startsOn, setStartsOn] = useState<string>(
        () =>
            preselectedDate ??
            nextOccurrenceDate(
                todayKey,
                preselectedDate ? dayOfWeekFromKey(preselectedDate) : 2,
            ),
    )
    const [notes, setNotes] = useState<string>('')

    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // Student picker (standalone flow) — MULTI: estúdios agendam vários alunos
    // no MESMO horário (decisão 17/jul); cada aluno vira uma rotina própria.
    const hasPreselectedStudent = !!preselectedStudentId
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
    const [studentQuery, setStudentQuery] = useState('')
    const [studentDropdownOpen, setStudentDropdownOpen] = useState(false)
    const studentPickerRef = useRef<HTMLDivElement | null>(null)

    // Reset on open
    useEffect(() => {
        if (!isOpen) return
        const initialDow = preselectedDate ? dayOfWeekFromKey(preselectedDate) : 2
        setSlots([makeInitialSlot(initialDow, preselectedTime ?? '07:00')])
        setFrequency('weekly')
        setStartsOn(preselectedDate ?? nextOccurrenceDate(todayKey, initialDow))
        setNotes('')
        setError(null)
        setLoading(false)
        setSelectedStudentIds([])
        setStudentQuery('')
        setStudentDropdownOpen(false)
    }, [isOpen, preselectedDate, preselectedTime, todayKey])

    // Close student dropdown on outside click
    useEffect(() => {
        if (!studentDropdownOpen) return
        const handler = (e: MouseEvent) => {
            if (
                studentPickerRef.current &&
                !studentPickerRef.current.contains(e.target as Node)
            ) {
                setStudentDropdownOpen(false)
            }
        }
        window.addEventListener('mousedown', handler)
        return () => window.removeEventListener('mousedown', handler)
    }, [studentDropdownOpen])

    const filteredStudents = useMemo(() => {
        if (!students) return []
        if (!studentQuery.trim()) return students
        return students.filter((s) => matchesSearch(s.name, studentQuery))
    }, [students, studentQuery])

    const selectedStudents = useMemo(() => {
        if (!students) return []
        return selectedStudentIds
            .map((id) => students.find((s) => s.id === id))
            .filter((s): s is NonNullable<typeof s> => !!s)
    }, [selectedStudentIds, students])

    const effectiveStudentIds = useMemo(
        () => (preselectedStudentId ? [preselectedStudentId] : selectedStudentIds),
        [preselectedStudentId, selectedStudentIds],
    )

    const isMonthly = frequency === 'monthly'
    const isOnce = frequency === 'once'
    /** Monthly e Once: força 1 slot só; day_of_week derivado de startsOn. */
    const isSingleSlotMode = isMonthly || isOnce

    // Single-slot modes: force exactly 1 slot and align its dayOfWeek to startsOn.
    useEffect(() => {
        if (!isSingleSlotMode) return
        const expectedDow = dayOfWeekFromKey(startsOn)
        setSlots((prev) => {
            const only = prev[0]
                ? { ...prev[0], dayOfWeek: expectedDow }
                : makeInitialSlot(expectedDow, '07:00')
            return [only]
        })
    }, [isSingleSlotMode, startsOn])

    const updateSlot = (id: string, patch: Partial<Slot>) => {
        setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    }

    const addSlot = () => {
        if (isSingleSlotMode) return
        if (slots.length >= MAX_SLOTS) return
        setSlots((prev) => [
            ...prev,
            makeInitialSlot(
                // Default new slot to a weekday not yet used if possible.
                prev.map((s) => s.dayOfWeek).includes(2) ? (2 + prev.length) % 7 : 2,
                '07:00',
            ),
        ])
    }

    const removeSlot = (id: string) => {
        setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)))
    }

    /** Returns true if the slot list has a duplicate dayOfWeek + startTime. */
    const duplicateError = useMemo(() => {
        const seen = new Set<string>()
        for (const s of slots) {
            const k = `${s.dayOfWeek}::${s.startTime}`
            if (seen.has(k)) return 'Há dois horários duplicados — remova um.'
            seen.add(k)
        }
        return null
    }, [slots])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        if (effectiveStudentIds.length === 0) {
            setError('Selecione ao menos um aluno')
            return
        }
        if (duplicateError) {
            setError(duplicateError)
            return
        }

        setLoading(true)
        try {
            const normalizedSlots = slots.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                durationMinutes: resolveDuration(s),
            }))

            // Uma rotina (ou pacote) POR ALUNO — vários alunos no mesmo horário
            // é o dia a dia de estúdio. Rotinas independentes: remarcar/cancelar
            // um aluno não afeta os demais.
            const failures: string[] = []
            let firstPayload: { recurringId?: string; groupId?: string } | null = null
            let firstError: string | null = null
            for (const studentId of effectiveStudentIds) {
                if (normalizedSlots.length === 1) {
                    const result = await createRecurringAppointment({
                        studentId,
                        ...normalizedSlots[0],
                        frequency,
                        startsOn,
                        notes: notes.trim() ? notes.trim() : null,
                    })
                    if (result.success && result.data) {
                        firstPayload ??= { recurringId: result.data.id }
                    } else {
                        failures.push(students?.find((st) => st.id === studentId)?.name ?? 'aluno')
                        firstError ??= result.error ?? null
                    }
                } else {
                    const result = await createRecurringAppointmentGroup({
                        studentId,
                        slots: normalizedSlots,
                        frequency,
                        startsOn,
                        notes: notes.trim() ? notes.trim() : null,
                    })
                    if (result.success && result.data) {
                        firstPayload ??= { groupId: result.data.groupId }
                    } else {
                        failures.push(students?.find((st) => st.id === studentId)?.name ?? 'aluno')
                        firstError ??= result.error ?? null
                    }
                }
            }

            if (failures.length === 0 && firstPayload) {
                onSuccess?.(firstPayload)
                onClose()
                return
            }
            if (firstPayload) {
                // Parcial: alguns criados — informa quem falhou (os criados ficam).
                onSuccess?.(firstPayload)
                setError(`Não foi possível agendar: ${failures.join(', ')}. Os demais foram criados.`)
                return
            }
            setError(firstError ?? 'Erro ao criar rotina')
        } catch (err) {
            // AG8: exceção da server action (rede) morria sem feedback — o
            // trainer clicava e nada acontecia.
            console.error('[create-appointment-modal] submit error:', err)
            setError('Erro de conexão ao criar. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const addDisabledReason = isOnce
        ? 'Agendamento único tem apenas 1 dia'
        : isMonthly
          ? 'Rotinas mensais permitem apenas um dia'
          : slots.length >= MAX_SLOTS
            ? `Máximo de ${MAX_SLOTS} dias`
            : null
    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={loading ? undefined : onClose}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl dark:border dark:border-transparent dark:backdrop-blur-xl dark:ring-1 dark:ring-k-border-primary animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-inset px-8 py-6 sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">
                            Novo agendamento
                        </h2>
                        {preselectedStudentName && (
                            <p className="text-xs text-[#86868B] dark:text-muted-foreground/60 font-medium mt-1">
                                Aluno: {preselectedStudentName}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={loading ? undefined : onClose}
                        aria-label="Fechar"
                        className="h-8 w-8 flex items-center justify-center text-[#AEAEB2] dark:text-muted-foreground/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-full transition-colors disabled:opacity-50"
                        disabled={loading}
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                <form
                    onSubmit={(e) => handleSubmit(e)}
                    className="bg-white dark:bg-transparent p-8 space-y-5"
                >
                    {error && (
                        <div
                            role="alert"
                            className="bg-[#FF3B30]/10 dark:bg-red-500/10 border border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            {error}
                        </div>
                    )}

                    {/* Student picker (standalone flow) */}
                    {!hasPreselectedStudent && (
                        <div ref={studentPickerRef}>
                            <label
                                htmlFor="studentPicker"
                                className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                            >
                                Alunos
                            </label>
                            <p className="-mt-0.5 mb-1.5 text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                                Adicione mais de um aluno para a mesma turma/horário.
                            </p>
                            {selectedStudents.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {selectedStudents.map((st) => (
                                        <span
                                            key={st.id}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-[#E0D7FF] dark:border-violet-500/30 bg-[#F3F0FF] dark:bg-violet-500/10 pl-2.5 pr-1 py-1 text-xs font-semibold text-[#7C3AED] dark:text-violet-300"
                                        >
                                            {st.name}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedStudentIds((prev) => prev.filter((id) => id !== st.id))}
                                                aria-label={`Remover ${st.name}`}
                                                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#7C3AED]/15"
                                            >
                                                <X className="h-3 w-3" strokeWidth={2} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {!students || students.length === 0 ? (
                                <div className="rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-white/5 px-3 py-2.5 text-xs text-[#86868B] dark:text-k-text-quaternary">
                                    Nenhum aluno disponível. Cadastre um aluno antes de criar uma rotina.
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary"
                                        strokeWidth={1.5}
                                    />
                                    <input
                                        id="studentPicker"
                                        type="text"
                                        value={studentQuery}
                                        onChange={(e) => {
                                            setStudentQuery(e.target.value)
                                            setStudentDropdownOpen(true)
                                        }}
                                        onFocus={() => setStudentDropdownOpen(true)}
                                        placeholder={selectedStudents.length > 0 ? 'Adicionar outro aluno no mesmo horário...' : 'Buscar aluno...'}
                                        autoComplete="off"
                                        className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg pl-9 pr-3 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#7C3AED] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#7C3AED]/20 dark:focus:ring-violet-500/20 transition-all"
                                    />
                                    {studentDropdownOpen && (
                                        <div
                                            role="listbox"
                                            className="absolute left-0 right-0 top-full mt-1 z-tooltip max-h-56 overflow-y-auto rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-lg"
                                        >
                                            {filteredStudents.length === 0 ? (
                                                <div className="px-3 py-2.5 text-xs text-[#86868B] dark:text-k-text-quaternary">
                                                    Nenhum aluno encontrado
                                                </div>
                                            ) : (
                                                filteredStudents.map((s) => {
                                                    const isSelected = selectedStudentIds.includes(s.id)
                                                    return (
                                                        <button
                                                            key={s.id}
                                                            type="button"
                                                            role="option"
                                                            aria-selected={isSelected}
                                                            onClick={() => {
                                                                setSelectedStudentIds((prev) =>
                                                                    isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                                                                )
                                                                setStudentQuery('')
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F5F5F7] dark:hover:bg-white/5 transition-colors text-left ${isSelected ? 'bg-[#F3F0FF]/60 dark:bg-violet-500/10' : ''}`}
                                                        >
                                                            <div className="h-7 w-7 shrink-0 rounded-full border border-[#E8E8ED] dark:border-border bg-[#F5F5F7] dark:bg-muted flex items-center justify-center overflow-hidden">
                                                                {s.avatarUrl ? (
                                                                    <Image
                                                                        src={s.avatarUrl}
                                                                        alt={s.name}
                                                                        width={28}
                                                                        height={28}
                                                                        className="h-7 w-7 object-cover"
                                                                        unoptimized
                                                                    />
                                                                ) : (
                                                                    <span className="text-xs font-bold text-[#7C3AED] dark:text-primary">
                                                                        {s.name.charAt(0).toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="flex-1 text-sm text-[#1D1D1F] dark:text-k-text-primary truncate">
                                                                {s.name}
                                                            </span>
                                                            {isSelected && (
                                                                <span className="text-[10px] font-bold uppercase text-[#7C3AED] dark:text-violet-400">na turma</span>
                                                            )}
                                                        </button>
                                                    )
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Frequency */}
                    <div>
                        <label className="mb-2 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                            Frequência
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-[#F5F5F7] dark:bg-surface-inset p-1 rounded-lg">
                            {(
                                [
                                    { value: 'once', label: 'Única' },
                                    { value: 'weekly', label: 'Semanal' },
                                    { value: 'biweekly', label: 'Quinzenal' },
                                    { value: 'monthly', label: 'Mensal' },
                                ] as const
                            ).map((opt) => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => setFrequency(opt.value)}
                                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 transition-all duration-200 text-xs font-semibold ${
                                        frequency === opt.value
                                            ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                            : 'text-[#86868B] dark:text-k-text-tertiary hover:text-[#6E6E73] dark:hover:text-k-text-secondary'
                                    }`}
                                >
                                    <Repeat className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Slots */}
                    <div>
                        <label className="mb-2 flex items-center justify-between text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                            <span>{isOnce ? 'Horário' : 'Dias e horários'}</span>
                            {isMonthly && (
                                <span className="text-[10px] font-medium normal-case text-[#86868B] dark:text-k-text-quaternary">
                                    (apenas 1 dia em mensal)
                                </span>
                            )}
                            {isOnce && (
                                <span className="text-[10px] font-medium normal-case text-[#86868B] dark:text-k-text-quaternary">
                                    (1 dia na data escolhida)
                                </span>
                            )}
                        </label>

                        <div className="space-y-2">
                            {slots.map((slot, idx) => (
                                <div
                                    key={slot.id}
                                    className="rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-white/5 p-3 space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:text-k-text-quaternary">
                                            Dia {idx + 1}
                                        </span>
                                        {slots.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSlot(slot.id)}
                                                aria-label={`Remover dia ${idx + 1}`}
                                                className="p-1 text-[#AEAEB2] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1">
                                        {DAY_ORDER.map((dow) => {
                                            const lbl = DAY_LABELS[dow]
                                            const selected = slot.dayOfWeek === dow
                                            const disabled = isSingleSlotMode
                                            return (
                                                <button
                                                    type="button"
                                                    key={dow}
                                                    onClick={() =>
                                                        !disabled && updateSlot(slot.id, { dayOfWeek: dow })
                                                    }
                                                    disabled={disabled}
                                                    aria-pressed={selected}
                                                    aria-label={`${lbl} — dia ${idx + 1}`}
                                                    className={`h-8 rounded-md text-[11px] font-semibold transition-all ${
                                                        selected
                                                            ? 'bg-[#7C3AED] dark:bg-violet-600 text-white shadow-sm'
                                                            : 'bg-white dark:bg-white/5 text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#E8E8ED] dark:hover:bg-white/10 border border-[#E8E8ED] dark:border-transparent'
                                                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {lbl}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Clock
                                                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AEAEB2] dark:text-k-text-quaternary"
                                                strokeWidth={1.5}
                                            />
                                            <input
                                                type="time"
                                                value={slot.startTime}
                                                onChange={(e) =>
                                                    updateSlot(slot.id, { startTime: e.target.value })
                                                }
                                                required
                                                aria-label={`Horário do dia ${idx + 1}`}
                                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg pl-8 pr-2 py-1.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#7C3AED] dark:focus:border-violet-500/50"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {DURATION_CHIPS.map((min) => {
                                                const active =
                                                    !slot.customDuration && slot.durationMinutes === min
                                                return (
                                                    <button
                                                        type="button"
                                                        key={min}
                                                        onClick={() =>
                                                            updateSlot(slot.id, {
                                                                durationMinutes: min,
                                                                customDuration: '',
                                                            })
                                                        }
                                                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                                            active
                                                                ? 'bg-[#7C3AED] dark:bg-violet-600 text-white'
                                                                : 'bg-white dark:bg-white/5 text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#E8E8ED] dark:hover:bg-white/10 border border-[#E8E8ED] dark:border-transparent'
                                                        }`}
                                                    >
                                                        {min}m
                                                    </button>
                                                )
                                            })}
                                            <input
                                                type="number"
                                                min={15}
                                                max={240}
                                                placeholder="Outra"
                                                value={slot.customDuration}
                                                onChange={(e) =>
                                                    updateSlot(slot.id, {
                                                        customDuration: e.target.value,
                                                    })
                                                }
                                                aria-label={`Duração personalizada do dia ${idx + 1}`}
                                                className="w-16 rounded-md border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-2 py-1 text-[11px] text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#7C3AED] dark:focus:border-violet-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {duplicateError && (
                            <p className="mt-2 text-[11px] text-red-500">{duplicateError}</p>
                        )}

                        <button
                            type="button"
                            onClick={addSlot}
                            disabled={!!addDisabledReason}
                            title={addDisabledReason ?? undefined}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-[#D2D2D7] dark:border-k-border-subtle rounded-lg text-xs font-semibold text-[#6E6E73] dark:text-k-text-secondary hover:border-[#7C3AED] dark:hover:border-violet-500 hover:text-[#7C3AED] dark:hover:text-violet-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#D2D2D7] disabled:hover:text-[#6E6E73]"
                        >
                            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                            Adicionar dia
                        </button>
                    </div>

                    {/* Starts on */}
                    <div>
                        <label
                            htmlFor="startsOn"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            {isOnce ? 'Data' : 'Data de início'}
                        </label>
                        <div className="relative">
                            <CalendarIcon
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary"
                                strokeWidth={1.5}
                            />
                            <input
                                id="startsOn"
                                type="date"
                                value={startsOn}
                                min={todayKey}
                                onChange={(e) => setStartsOn(e.target.value)}
                                required
                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-2.5 text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#7C3AED] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#7C3AED]/20 dark:focus:ring-violet-500/20 transition-all text-sm"
                            />
                        </div>
                        {isMonthly && (
                            <p className="mt-1.5 text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                                Rotinas mensais repetem na mesma data de cada mês.
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label
                            htmlFor="notes"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            Notas (opcional)
                        </label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={500}
                            rows={2}
                            placeholder="Ex: treino A toda terça, treino B toda quinta"
                            className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-3.5 py-2.5 text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#7C3AED] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#7C3AED]/20 dark:focus:ring-violet-500/20 transition-all text-sm resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={loading ? undefined : onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#7C3AED] dark:text-k-text-secondary hover:text-[#6D28D9] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-full transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={
                                loading ||
                                !!duplicateError ||
                                effectiveStudentIds.length === 0
                            }
                            title={
                                effectiveStudentIds.length === 0
                                    ? 'Selecione ao menos um aluno'
                                    : undefined
                            }
                            className="flex-1 px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" strokeWidth={2} />
                                    {effectiveStudentIds.length > 1
                                        ? `Agendar ${effectiveStudentIds.length} alunos`
                                        : slots.length > 1 ? 'Criar pacote' : 'Criar agendamento'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
