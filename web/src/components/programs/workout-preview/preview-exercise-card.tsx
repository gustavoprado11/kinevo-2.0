import {
    ArrowRightLeft,
    Check,
    ChevronsDown,
    Dumbbell,
    Layers,
    Pencil,
    PlayCircle,
    TrendingDown,
    TrendingUp,
    type LucideIcon,
} from 'lucide-react'
import { colors, spacing, typography } from './preview-design-tokens'
import { PreviewSetRow } from './preview-set-row'
import { PreviewTrainerNote } from './preview-trainer-note'
import type { PreviewExercise, PreviewPhase } from './builder-to-preview'
import type { MethodKey } from '@kinevo/shared/types/prescription'
import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels'

interface PreviewExerciseCardProps {
    exercise: PreviewExercise
}

const METHOD_ICON: Record<Exclude<MethodKey, 'standard'>, LucideIcon> = {
    pyramid_down: TrendingDown,
    pyramid_up: TrendingUp,
    drop_set: ChevronsDown,
    cluster: Layers,
    top_backoff: TrendingUp,
    '5x5': Dumbbell,
    custom: Pencil,
}

/** Header summary string mirroring mobile/components/workout/ExerciseCard.tsx
 *  (Fase 4.3+). Compound rounds > 1 → "3 rodadas · 2 fases · 10/8 reps".
 *  Linear with multiple phases → "4 séries • 12-10-8-6 reps • 90s descanso".
 *  Legacy (no scheme) → keeps the old "{sets} séries • {reps} reps • {rest}s descanso". */
function buildHeaderSummary(exercise: PreviewExercise): string {
    const phases = exercise.phases
    if (phases.length === 0) {
        return `${exercise.sets} séries • ${exercise.reps} reps • ${exercise.restSeconds}s descanso`
    }
    if (exercise.rounds > 1) {
        const phasesPerRound = Math.max(1, Math.floor(phases.length / exercise.rounds))
        const firstRoundReps = phases
            .slice(0, phasesPerRound)
            .map((p) => (p.repsTarget?.trim() || '0'))
            .join('/')
        return `${exercise.rounds} rodadas · ${phasesPerRound} fases · ${firstRoundReps} reps`
    }
    // Linear with multiple phases — joins distinct reps with '-' or returns single value.
    const repsValues = phases.map((p) => (p.repsTarget?.trim() || '0'))
    const allEqual = repsValues.every((r) => r === repsValues[0])
    const repsSummary = allEqual ? repsValues[0] : repsValues.join('-')
    const minRest = phases.reduce(
        (min, p) => Math.min(min, Math.max(0, p.restSeconds ?? 0)),
        Number.POSITIVE_INFINITY,
    )
    const safeRest = Number.isFinite(minRest) ? minRest : exercise.restSeconds
    return `${phases.length} séries • ${repsSummary} reps • ${safeRest}s descanso`
}

interface RoundGroup {
    roundNumber: number
    phases: Array<{ phase: PreviewPhase; globalIndex: number }>
}

/** Group materialized phases by `roundNumber` for compound rendering. Linear
 *  methods (rounds=1) collapse to a single group with no header. */
function groupByRound(phases: PreviewPhase[], rounds: number): RoundGroup[] {
    if (rounds <= 1 || phases.length === 0) {
        return [
            {
                roundNumber: 1,
                phases: phases.map((p, idx) => ({ phase: p, globalIndex: idx })),
            },
        ]
    }
    const phasesPerRound = Math.max(1, Math.floor(phases.length / rounds))
    return Array.from({ length: rounds }, (_, r) => {
        const start = r * phasesPerRound
        const slice = phases.slice(start, start + phasesPerRound)
        return {
            roundNumber: r + 1,
            phases: slice.map((p, i) => ({ phase: p, globalIndex: start + i })),
        }
    })
}

export function PreviewExerciseCard({ exercise }: PreviewExerciseCardProps) {
    const headerSummary = buildHeaderSummary(exercise)
    const methodChip = getMethodChipLabel(exercise.methodKey)
    const MethodIcon =
        exercise.methodKey && exercise.methodKey !== 'standard'
            ? METHOD_ICON[exercise.methodKey] ?? Dumbbell
            : null

    const isCompoundLayout = exercise.rounds > 1 && exercise.phases.length > 0
    const roundGroups = groupByRound(exercise.phases, exercise.rounds)

    return (
        <div
            style={{
                backgroundColor: colors.bgCard,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: colors.bgCardBorder,
                borderRadius: spacing.cardBorderRadius,
                padding: spacing.cardPadding,
                marginBottom: spacing.cardMarginBottom,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, marginRight: 8 }}>
                    {/* Name + method chip */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginBottom: 2,
                        }}
                    >
                        <span style={{ fontSize: typography.exerciseName.fontSize, fontWeight: typography.exerciseName.fontWeight, color: colors.textPrimary }}>
                            {exercise.name}
                        </span>
                        {methodChip && MethodIcon ? (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingLeft: 8,
                                    paddingRight: 8,
                                    paddingTop: 3,
                                    paddingBottom: 3,
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(124, 58, 237, 0.12)',
                                    border: '1px solid rgba(124, 58, 237, 0.25)',
                                }}
                                aria-label={`Método: ${methodChip}`}
                            >
                                <MethodIcon size={11} color="#6d28d9" strokeWidth={2.4} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', letterSpacing: 0.2 }}>
                                    {methodChip}
                                </span>
                            </span>
                        ) : null}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: typography.exerciseMeta.fontSize }}>
                        {headerSummary}
                    </div>
                    {exercise.supersetBadge && (
                        <div style={{ color: colors.violet600, fontSize: typography.supersetBadge.fontSize, fontWeight: typography.supersetBadge.fontWeight, marginTop: 2 }}>
                            {exercise.supersetBadge}
                        </div>
                    )}
                    {exercise.notes && <PreviewTrainerNote note={exercise.notes} />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: spacing.actionBtnPadding, borderRadius: spacing.actionBtnRadius, backgroundColor: colors.actionBtnBg }}>
                        <ArrowRightLeft size={18} color={colors.violet600} />
                    </div>
                    <div style={{ padding: spacing.actionBtnPadding, borderRadius: spacing.actionBtnRadius, backgroundColor: colors.actionBtnBg }}>
                        <PlayCircle size={18} color={colors.violet600} />
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4, paddingRight: 4, marginBottom: 2 }}>
                <div style={{ width: spacing.setBadgeSize, marginRight: 6 }}>
                    <span style={{ color: colors.textTertiary, fontSize: typography.columnHeader.fontSize, fontWeight: typography.columnHeader.fontWeight, display: 'block', textAlign: 'center' }}>#</span>
                </div>
                <div style={{ width: spacing.previousColWidth, marginRight: 6 }}>
                    <span style={{ color: colors.textTertiary, fontSize: typography.columnHeader.fontSize, fontWeight: typography.columnHeader.fontWeight, display: 'block', textAlign: 'center' }}>Anterior</span>
                </div>
                <div style={{ flex: 1, marginRight: 6 }}>
                    <span style={{ color: colors.textTertiary, fontSize: typography.columnHeader.fontSize, fontWeight: typography.columnHeader.fontWeight, display: 'block', textAlign: 'center' }}>Peso</span>
                </div>
                <div style={{ flex: 1, marginRight: 6 }}>
                    <span style={{ color: colors.textTertiary, fontSize: typography.columnHeader.fontSize, fontWeight: typography.columnHeader.fontWeight, display: 'block', textAlign: 'center' }}>Reps</span>
                </div>
                <div style={{ width: spacing.checkBtnSize, display: 'flex', justifyContent: 'center' }}>
                    <Check size={10} color={colors.textTertiary} />
                </div>
            </div>

            {/* Set Rows — grouped by round when compound */}
            <div>
                {isCompoundLayout ? (
                    roundGroups.map((group, groupIdx) => (
                        <div
                            key={`round-${group.roundNumber}`}
                            style={{
                                marginTop: groupIdx === 0 ? 0 : 10,
                                paddingTop: groupIdx === 0 ? 0 : 6,
                                borderTopWidth: groupIdx === 0 ? 0 : 1,
                                borderTopStyle: 'solid',
                                borderTopColor: 'rgba(124, 58, 237, 0.12)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingLeft: 4,
                                    paddingRight: 4,
                                    marginBottom: 4,
                                }}
                            >
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                                    Rodada {group.roundNumber} de {exercise.rounds}
                                </span>
                                <div
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'transparent',
                                        border: '1.5px solid #cbd5e1',
                                    }}
                                    aria-label="Rodada em andamento"
                                />
                            </div>
                            {group.phases.map(({ phase, globalIndex }) => (
                                <PreviewSetRow
                                    key={globalIndex}
                                    index={globalIndex}
                                    phase={phase}
                                />
                            ))}
                        </div>
                    ))
                ) : (
                    exercise.setsData.map((_, index) => (
                        <PreviewSetRow
                            key={index}
                            index={index}
                            phase={exercise.phases[index] ?? null}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
