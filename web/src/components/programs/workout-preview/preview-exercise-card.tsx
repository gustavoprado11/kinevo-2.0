import { ArrowRightLeft, PlayCircle, Check } from 'lucide-react'
import { colors, spacing, typography } from './preview-design-tokens'
import { PreviewSetRow } from './preview-set-row'
import { PreviewTrainerNote } from './preview-trainer-note'
import type { PreviewExercise } from './builder-to-preview'

interface PreviewExerciseCardProps {
    exercise: PreviewExercise
}

export function PreviewExerciseCard({ exercise }: PreviewExerciseCardProps) {
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
                    <div style={{ fontSize: typography.exerciseName.fontSize, fontWeight: typography.exerciseName.fontWeight, color: colors.textPrimary, marginBottom: 2 }}>
                        {exercise.name}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: typography.exerciseMeta.fontSize }}>
                        {exercise.sets} séries • {exercise.reps} reps • {exercise.restSeconds}s descanso
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

            {/* Set Rows */}
            <div>
                {exercise.setsData.map((_, index) => (
                    <PreviewSetRow key={index} index={index} />
                ))}
            </div>
        </div>
    )
}
