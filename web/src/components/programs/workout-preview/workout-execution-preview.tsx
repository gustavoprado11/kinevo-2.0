'use client'

import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { PhoneFrame } from './phone-frame'
import { PreviewExerciseCard } from './preview-exercise-card'
import { PreviewSupersetGroup } from './preview-superset-group'
import { PreviewNoteCard } from './preview-note-card'
import { builderItemsToPreview } from './builder-to-preview'
import { colors, spacing, typography } from './preview-design-tokens'
import type { WorkoutItem } from '../program-builder-client'

interface WorkoutExecutionPreviewProps {
    workoutName: string
    items: WorkoutItem[]
}

export function WorkoutExecutionPreview({ workoutName, items }: WorkoutExecutionPreviewProps) {
    const renderItems = useMemo(() => builderItemsToPreview(items), [items])

    // Count total sets for progress display
    const totalSets = useMemo(() => {
        let count = 0
        for (const item of renderItems) {
            if (item.type === 'exercise') count += item.exercise.setsData.length
            if (item.type === 'superset') {
                for (const ex of item.exercises) count += ex.setsData.length
            }
        }
        return count
    }, [renderItems])

    return (
        <PhoneFrame>
            {/* Header — matches mobile's header exactly */}
            <div
                style={{
                    backgroundColor: '#fff',
                    borderBottom: `1px solid ${colors.headerBorder}`,
                    paddingLeft: spacing.headerPaddingH,
                    paddingRight: spacing.headerPaddingH,
                    paddingTop: spacing.headerPaddingTop + 40, // extra for dynamic island
                    paddingBottom: spacing.headerPaddingBottom,
                    flexShrink: 0,
                }}
            >
                {/* Top row: back | name + timer | spacer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: 8, marginLeft: -8 }}>
                        <ChevronLeft size={24} color={colors.textPrimary} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: colors.textPrimary, fontWeight: typography.workoutName.fontWeight, fontSize: typography.workoutName.fontSize }}>
                            {workoutName || 'Treino'}
                        </div>
                        <div style={{ color: colors.textSecondary, fontFamily: typography.timer.fontFamily, fontSize: typography.timer.fontSize }}>
                            00:00
                        </div>
                    </div>
                    <div style={{ width: 40 }} />
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 12 }}>
                    <div style={{ height: spacing.progressHeight, backgroundColor: colors.progressTrack, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '0%', backgroundColor: colors.progressFill, borderRadius: 2 }} />
                    </div>
                    <div style={{ color: colors.textTertiary, fontSize: typography.progressCount.fontSize, marginTop: 4, textAlign: 'right' }}>
                        0/{totalSets} séries
                    </div>
                </div>
            </div>

            {/* Scrollable content */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 16,
                    backgroundColor: colors.bgScreen,
                }}
            >
                {renderItems.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                        <span style={{ color: colors.textTertiary, fontSize: 14 }}>
                            Adicione exercícios para visualizar
                        </span>
                    </div>
                )}

                {renderItems.map((item, idx) => {
                    if (item.type === 'section_header') {
                        return (
                            <div key={`header-${item.label}-${idx}`} style={{ marginTop: spacing.sectionHeaderMarginTop, marginBottom: spacing.sectionHeaderMarginBottom, paddingLeft: 4, paddingRight: 4 }}>
                                <span style={{ fontSize: typography.sectionHeader.fontSize, fontWeight: typography.sectionHeader.fontWeight, letterSpacing: typography.sectionHeader.letterSpacing, color: colors.sectionHeaderColor }}>
                                    {item.label}
                                </span>
                            </div>
                        )
                    }

                    if (item.type === 'note') {
                        return <PreviewNoteCard key={`note-${idx}`} text={item.text} />
                    }

                    if (item.type === 'superset') {
                        return (
                            <PreviewSupersetGroup
                                key={`superset-${idx}`}
                                exercises={item.exercises}
                                supersetRestSeconds={item.supersetRestSeconds}
                            />
                        )
                    }

                    if (item.type === 'exercise') {
                        return <PreviewExerciseCard key={item.exercise.id} exercise={item.exercise} />
                    }

                    return null
                })}

                {/* Bottom padding for finish button area */}
                <div style={{ height: 24 }} />
            </div>

            {/* Finish button */}
            <div
                style={{
                    paddingLeft: spacing.footerPaddingH,
                    paddingRight: spacing.footerPaddingH,
                    paddingTop: spacing.footerPaddingTop,
                    paddingBottom: spacing.footerPaddingBottom,
                    backgroundColor: colors.bgScreen,
                    borderTop: `0.5px solid ${colors.headerBorder}`,
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        backgroundColor: colors.btnFinishInactive,
                        borderRadius: spacing.finishBtnRadius,
                        height: spacing.finishBtnHeight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <span style={{ color: colors.textSecondary, fontWeight: typography.finishBtn.fontWeight, fontSize: typography.finishBtn.fontSize }}>
                        Finalizar (0/{totalSets})
                    </span>
                </div>
            </div>
        </PhoneFrame>
    )
}
