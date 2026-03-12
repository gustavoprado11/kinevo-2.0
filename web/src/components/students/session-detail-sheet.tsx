'use client'

import { useEffect, useState } from 'react'
import { X, Clock, Activity, Dumbbell, Flame, Heart, StickyNote, Layers } from 'lucide-react'
import { getSessionDetails } from '@/app/students/[id]/actions/get-session-details'
import { CheckinResponsesViewer, InlineCheckinSummary } from '@/components/forms/checkin-responses-viewer'
import type { SessionDetailsData, SessionItem, SessionSetLog, CardioResult } from '@/app/students/[id]/actions/get-session-details'
import {
    WARMUP_TYPE_LABELS,
    CARDIO_EQUIPMENT_LABELS,
    type WarmupType,
    type CardioEquipment,
    type WarmupConfig,
    type CardioConfig,
} from '@kinevo/shared/types/workout-items'

interface SessionDetailSheetProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string | null
}

// ── Intensity Gauge ──

function IntensityGauge({ value }: { value: number | null }) {
    if (!value) return (
        <div className="w-20 h-20 rounded-full bg-[#F5F5F7] dark:bg-glass-bg border border-[#E8E8ED] dark:border-k-border-primary flex items-center justify-center">
            <span className="text-[#AEAEB2] dark:text-k-text-quaternary text-xs font-bold leading-none">N/A</span>
        </div>
    )

    return (
        <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <div
                className="absolute inset-0 rounded-full opacity-40 blur-[2px]"
                style={{ background: `conic-gradient(from 180deg at 50% 50%, #8b5cf6 ${value * 10}%, transparent 0)` }}
            />
            <div className="absolute inset-1 rounded-full bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary" />
            <div className="relative z-sticky flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 mb-0.5">PSE</span>
                <span className="text-4xl font-black text-[#1D1D1F] dark:text-white tracking-tighter leading-none">{value}</span>
            </div>
        </div>
    )
}

// ── Stat Card ──

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
    return (
        <div className="bg-[#F5F5F7] dark:bg-glass-bg rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle p-4">
            <div className="flex items-center gap-1.5 text-[#86868B] dark:text-k-text-quaternary mb-1">
                <Icon size={13} strokeWidth={1.5} className={accent} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-lg font-bold text-[#1D1D1F] dark:text-white">{value}</span>
        </div>
    )
}

// ── Item Renderers ──

function WarmupLogItem({ item }: { item: SessionItem }) {
    const config = item.itemConfig as WarmupConfig | undefined
    const warmupType = config?.warmup_type as WarmupType | undefined
    const label = warmupType ? WARMUP_TYPE_LABELS[warmupType] : 'Aquecimento'
    const duration = config?.duration_minutes

    return (
        <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/10 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Flame size={16} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white">{label}</p>
                {(config?.description || duration) && (
                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5 truncate">
                        {duration ? `${duration} min` : ''}{duration && config?.description ? ' · ' : ''}{config?.description || ''}
                    </p>
                )}
            </div>
        </div>
    )
}

function CardioLogItem({ item }: { item: SessionItem }) {
    const config = item.itemConfig as CardioConfig | undefined
    const result = item.cardioResult
    const equipment = (result?.equipment || config?.equipment) as CardioEquipment | undefined
    const equipmentLabel = equipment ? CARDIO_EQUIPMENT_LABELS[equipment] : 'Aeróbio'
    const mode = result?.mode || config?.mode

    const details: string[] = []
    if (result?.durationMinutes) details.push(`${result.durationMinutes} min`)
    else if (config?.duration_minutes) details.push(`${config.duration_minutes} min`)
    if (result?.distanceKm) details.push(`${result.distanceKm} km`)
    else if (config?.distance_km) details.push(`${config.distance_km} km`)
    if (result?.intensity || config?.intensity) details.push(result?.intensity || config?.intensity || '')
    if (mode === 'interval' && (result?.intervals || config?.intervals)) {
        const iv = result?.intervals || config?.intervals
        if (iv) details.push(`${iv.rounds}x (${iv.work_seconds}s/${iv.rest_seconds}s)`)
    }

    return (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/10 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Heart size={16} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white">
                    {equipmentLabel}
                    {mode && <span className="text-xs text-[#86868B] dark:text-k-text-quaternary font-normal ml-1.5">
                        {mode === 'continuous' ? 'Contínuo' : 'Intervalado'}
                    </span>}
                </p>
                {details.length > 0 && (
                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5 truncate">
                        {details.join(' · ')}
                    </p>
                )}
            </div>
        </div>
    )
}

function NoteLogItem({ item }: { item: SessionItem }) {
    if (!item.notes) return null
    return (
        <div className="flex items-start gap-3 bg-[#F5F5F7] dark:bg-glass-bg rounded-xl px-4 py-3 border border-[#E8E8ED] dark:border-k-border-subtle">
            <StickyNote size={14} className="text-[#86868B] dark:text-k-text-quaternary shrink-0 mt-0.5" />
            <p className="text-xs text-[#6E6E73] dark:text-k-text-secondary italic leading-relaxed">{item.notes}</p>
        </div>
    )
}

function ExerciseLogItem({ item }: { item: SessionItem }) {
    const hasLogs = item.setLogs.length > 0
    const functionLabel = item.exerciseFunction
        ? { warmup: 'Aquecimento', activation: 'Ativação', main: 'Principal', accessory: 'Acessório', conditioning: 'Condicionamento' }[item.exerciseFunction] || null
        : null

    return (
        <div className="group">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-[#1D1D1F] dark:text-white tracking-tight leading-none">
                        {item.exerciseName || 'Exercício'}
                    </h4>
                    {functionLabel && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500">
                            {functionLabel}
                        </span>
                    )}
                </div>
                {item.setsPrescribed && (
                    <span className="text-[10px] font-bold text-[#86868B] dark:text-k-text-quaternary">
                        {item.setLogs.length}/{item.setsPrescribed} séries
                    </span>
                )}
            </div>

            {hasLogs ? (
                <div className="bg-[#F5F5F7] dark:bg-surface-inset rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle overflow-hidden">
                    <div className="grid grid-cols-4 bg-[#ECECF0] dark:bg-glass-bg py-2 px-4 text-[10px] font-black text-[#86868B] dark:text-k-text-quaternary">
                        <div>Série</div>
                        <div className="text-center">Carga</div>
                        <div className="text-center">Reps</div>
                        <div className="text-right">PSE</div>
                    </div>
                    <div className="divide-y divide-[#E8E8ED] dark:divide-white/5">
                        {item.setLogs.map((set, idx) => (
                            <div key={idx} className="grid grid-cols-4 items-center py-3 px-4 hover:bg-[#ECECF0] dark:hover:bg-glass-bg transition-colors">
                                <div className="text-xs font-mono text-[#86868B] dark:text-k-text-tertiary">{set.setNumber}</div>
                                <div className="text-center text-sm font-semibold text-[#1D1D1F] dark:text-white">
                                    {set.weight > 0 ? `${set.weight}${set.weightUnit || 'kg'}` : '-'}
                                </div>
                                <div className="text-center text-sm font-mono text-[#6E6E73] dark:text-k-text-secondary">{set.reps}</div>
                                <div className="flex justify-end">
                                    {set.rpe ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20">
                                            {set.rpe}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-[#AEAEB2] dark:text-k-border-subtle">-</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-[#86868B] dark:text-k-text-quaternary italic px-1">
                    Sem séries registradas{item.repsPrescribed ? ` (prescrito: ${item.setsPrescribed}×${item.repsPrescribed})` : ''}
                </p>
            )}
        </div>
    )
}

function SupersetLogItem({ item }: { item: SessionItem }) {
    const childCount = item.children?.length || 0
    const label = childCount <= 2 ? 'Bi-set' : childCount === 3 ? 'Tri-set' : `Super-set (${childCount})`

    return (
        <div className="rounded-xl border border-violet-500/20 dark:border-violet-500/15 overflow-hidden">
            <div className="flex items-center gap-2 bg-violet-500/5 dark:bg-violet-500/5 px-4 py-2.5">
                <Layers size={13} className="text-violet-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    {label}
                </span>
                {item.restSeconds && (
                    <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary ml-auto">
                        Descanso: {item.restSeconds}s
                    </span>
                )}
            </div>
            <div className="p-4 space-y-6">
                {(item.children || []).map(child => (
                    <ExerciseLogItem key={child.id} item={child} />
                ))}
            </div>
        </div>
    )
}

// ── Session Item Router ──

function SessionItemRenderer({ item }: { item: SessionItem }) {
    switch (item.itemType) {
        case 'warmup': return <WarmupLogItem item={item} />
        case 'cardio': return <CardioLogItem item={item} />
        case 'note': return <NoteLogItem item={item} />
        case 'superset': return <SupersetLogItem item={item} />
        case 'exercise': return <ExerciseLogItem item={item} />
        default: return null
    }
}

// ── Main Component ──

export function SessionDetailSheet({ isOpen, onClose, sessionId }: SessionDetailSheetProps) {
    const [details, setDetails] = useState<SessionDetailsData | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [viewingCheckin, setViewingCheckin] = useState<'pre' | 'post' | null>(null)

    useEffect(() => {
        if (isOpen && sessionId) {
            setIsLoading(true)
            setError(null)

            getSessionDetails(sessionId)
                .then(result => {
                    if (result.success && result.data) {
                        setDetails(result.data)
                    } else {
                        setError(result.error || 'Erro desconhecido ao carregar detalhes')
                        setDetails(null)
                    }
                })
                .catch(err => {
                    console.error('Error fetching session details:', err)
                    setError('Erro de conexão ou servidor')
                    setDetails(null)
                })
                .finally(() => setIsLoading(false))
        } else {
            setDetails(null)
            setError(null)
        }
    }, [isOpen, sessionId])

    if (!isOpen) return null

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    return (
        <div className="fixed inset-0 z-tooltip flex items-center justify-center p-4 sm:p-8">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 dark:bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-surface-card rounded-2xl shadow-2xl border border-[#D2D2D7] dark:border-k-border-primary flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-sticky p-2 bg-[#F5F5F7] dark:bg-glass-bg hover:bg-[#ECECF0] dark:hover:bg-glass-bg-active rounded-full text-[#AEAEB2] dark:text-k-text-tertiary hover:text-[#6E6E73] dark:hover:text-k-text-primary transition-all border border-[#E8E8ED] dark:border-k-border-subtle"
                >
                    <X size={18} strokeWidth={1.5} />
                </button>

                {/* Content — Scrollable */}
                <div className="flex-1 overflow-y-auto px-8 pt-8 pb-12 space-y-8">
                    {isLoading ? (
                        <div className="space-y-6 py-8">
                            <div className="h-24 bg-[#F5F5F7] dark:bg-glass-bg rounded-2xl animate-pulse" />
                            <div className="grid grid-cols-4 gap-3">
                                {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#F5F5F7] dark:bg-glass-bg rounded-xl animate-pulse" />)}
                            </div>
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-[#F5F5F7] dark:bg-glass-bg rounded-2xl animate-pulse" />)}
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                                <X className="text-red-500 dark:text-red-400" size={32} strokeWidth={1.5} />
                            </div>
                            <p className="text-[#1D1D1F] dark:text-white font-bold tracking-tight mb-2">Erro ao carregar detalhes</p>
                            <p className="text-sm text-[#86868B] dark:text-k-text-tertiary mb-6">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-[#F5F5F7] dark:bg-glass-bg hover:bg-[#ECECF0] dark:hover:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary text-xs font-bold rounded-xl border border-[#D2D2D7] dark:border-k-border-primary transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    ) : details ? (
                        <>
                            {/* Header */}
                            <header className="flex items-start justify-between gap-6 pr-10">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 mb-2 uppercase tracking-wider">Treino Executado</p>
                                    <h2 className="text-3xl font-black text-[#1D1D1F] dark:text-white tracking-tighter truncate leading-none mb-3">
                                        {details.assigned_workouts?.name || 'Treino'}
                                    </h2>
                                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary font-bold">
                                        {new Date(details.completed_at).toLocaleDateString('pt-BR', {
                                            day: '2-digit', month: 'long', year: 'numeric',
                                        })} • {new Date(details.completed_at).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <IntensityGauge value={details.rpe} />
                            </header>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatCard icon={Clock} label="Duração" value={formatDuration(details.stats.durationSeconds)} />
                                <StatCard icon={Dumbbell} label="Exercícios" value={String(details.stats.exerciseCount)} />
                                <StatCard icon={Activity} label="Séries" value={`${details.stats.completedSets}${details.stats.totalSetsPrescribed ? `/${details.stats.totalSetsPrescribed}` : ''}`} />
                                <StatCard icon={Activity} label="Tonelagem" value={`${details.stats.totalTonnage.toLocaleString('pt-BR')} kg`} />
                            </div>

                            {/* Pre-workout checkin */}
                            {details.preCheckin && (
                                <InlineCheckinSummary
                                    type="pre"
                                    data={details.preCheckin}
                                    onViewFull={() => setViewingCheckin('pre')}
                                />
                            )}

                            {/* Workout Items Timeline */}
                            {details.items.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wider">
                                        Log do Treino
                                    </h3>
                                    <div className="space-y-4">
                                        {details.items.map(item => (
                                            <SessionItemRenderer key={item.id} item={item} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details.items.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-[#86868B] dark:text-k-text-quaternary">Nenhum exercício registrado nesta sessão</p>
                                </div>
                            )}

                            {/* Post-workout checkin */}
                            {details.postCheckin && (
                                <InlineCheckinSummary
                                    type="post"
                                    data={details.postCheckin}
                                    onViewFull={() => setViewingCheckin('post')}
                                />
                            )}

                            {/* Feedback */}
                            {details.feedback && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wider">
                                        Feedback do Aluno
                                    </h3>
                                    <div className="bg-[#F5F5F7] dark:bg-glass-bg backdrop-blur-md rounded-xl p-5 border border-[#E8E8ED] dark:border-k-border-subtle italic text-[#6E6E73] dark:text-k-text-secondary text-sm leading-relaxed">
                                        &ldquo;{details.feedback}&rdquo;
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>

            {/* Checkin Viewer Modal */}
            {viewingCheckin && details && (() => {
                const checkin = viewingCheckin === 'pre' ? details.preCheckin : details.postCheckin
                if (!checkin) return null
                return (
                    <CheckinResponsesViewer
                        title={viewingCheckin === 'pre' ? 'Check-in Pré-treino' : 'Check-in Pós-treino'}
                        date={checkin.submittedAt || details.completed_at}
                        answers={checkin.answersJson}
                        schema={checkin.schemaJson}
                        workoutName={details.assigned_workouts?.name}
                        onClose={() => setViewingCheckin(null)}
                    />
                )
            })()}
        </div>
    )
}
