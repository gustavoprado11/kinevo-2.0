import { Repeat, Clock } from 'lucide-react'
import { colors, spacing, typography } from './preview-design-tokens'
import { PreviewExerciseCard } from './preview-exercise-card'
import type { PreviewExercise } from './builder-to-preview'

interface PreviewSupersetGroupProps {
    exercises: PreviewExercise[]
    supersetRestSeconds: number
}

export function PreviewSupersetGroup({ exercises, supersetRestSeconds }: PreviewSupersetGroupProps) {
    const totalRounds = Math.max(...exercises.map(e => e.setsData.length), 0)

    return (
        <div
            style={{
                borderWidth: spacing.supersetBorderWidth,
                borderStyle: 'solid',
                borderColor: colors.supersetBorder,
                backgroundColor: colors.supersetBg,
                borderRadius: spacing.supersetBorderRadius,
                padding: spacing.supersetPadding,
                marginBottom: spacing.cardMarginBottom,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingRight: 4 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 4,
                        paddingBottom: 4,
                        backgroundColor: colors.supersetBadgeBg,
                        borderRadius: 8,
                    }}
                >
                    <Repeat size={12} color={colors.violet600} />
                    <span style={{ fontSize: typography.supersetLabel.fontSize, fontWeight: typography.supersetLabel.fontWeight, color: colors.violet600, textTransform: 'uppercase', letterSpacing: typography.supersetLabel.letterSpacing }}>
                        Superset
                    </span>
                </div>
                <div
                    style={{
                        backgroundColor: colors.supersetRoundBg,
                        borderRadius: 8,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 3,
                        paddingBottom: 3,
                    }}
                >
                    <span style={{ fontSize: typography.supersetRound.fontSize, fontWeight: typography.supersetRound.fontWeight, color: colors.violet600 }}>
                        Rodada 1 de {totalRounds}
                    </span>
                </div>
            </div>

            {/* Exercise cards with connectors */}
            {exercises.map((exercise, idx) => (
                <div key={exercise.id}>
                    <PreviewExerciseCard exercise={exercise} />
                    {/* "sem descanso" connector between exercises */}
                    {idx < exercises.length - 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, marginBottom: 8 }}>
                            <div style={{ height: 1, flex: 1, backgroundColor: colors.supersetConnector }} />
                            <span style={{ color: colors.violet500, fontSize: typography.supersetConnector.fontSize, marginLeft: 8, marginRight: 8, fontWeight: typography.supersetConnector.fontWeight }}>
                                sem descanso
                            </span>
                            <div style={{ height: 1, flex: 1, backgroundColor: colors.supersetConnector }} />
                        </div>
                    )}
                </div>
            ))}

            {/* Rest info footer */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 4,
                    paddingTop: 6,
                    paddingBottom: 6,
                    paddingLeft: 12,
                    paddingRight: 12,
                    backgroundColor: colors.supersetRestBg,
                    borderRadius: 10,
                }}
            >
                <Clock size={12} color={colors.violet500} />
                <span style={{ color: colors.violet600, fontSize: typography.supersetRest.fontSize, fontWeight: typography.supersetRest.fontWeight }}>
                    Descanso entre rodadas: {supersetRestSeconds}s
                </span>
            </div>
        </div>
    )
}
