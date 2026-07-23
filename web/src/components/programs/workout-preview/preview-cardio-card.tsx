'use client'

import { Activity, Bike, Footprints, Waves, TrendingUp, Zap, Dumbbell } from 'lucide-react'
import { cardioTotalSeconds, segmentStructureLabel } from '@kinevo/shared/lib/cardio/segments'
import { maxProgressionWeek } from '@kinevo/shared/lib/cardio/progression'
import type { CardioConfig, CardioSegment } from '@kinevo/shared/types/workout-items'
import type { PreviewWarmupCardio } from './builder-to-preview'
import { colors, spacing } from './preview-design-tokens'

const EQUIPMENT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
    treadmill: Footprints,
    bike: Bike,
    elliptical: TrendingUp,
    rower: Waves,
    stairmaster: TrendingUp,
    jump_rope: Zap,
    outdoor_run: Footprints,
    outdoor_bike: Bike,
    swimming: Waves,
    other: Dumbbell,
}

const EQUIPMENT_LABELS: Record<string, string> = {
    treadmill: 'Esteira',
    bike: 'Bicicleta',
    elliptical: 'Elíptico',
    rower: 'Remo',
    stairmaster: 'Escada',
    jump_rope: 'Corda',
    outdoor_run: 'Corrida',
    outdoor_bike: 'Bike Outdoor',
    swimming: 'Natação',
    other: 'Outro',
}

function formatEstimatedDuration(totalSeconds: number): string {
    const min = Math.floor(totalSeconds / 60)
    const sec = totalSeconds % 60
    if (min === 0) return `${sec}s`
    if (sec === 0) return `${min}min`
    return `${min}min ${sec}s`
}

interface PreviewCardioCardProps {
    item: PreviewWarmupCardio
}

export function PreviewCardioCard({ item }: PreviewCardioCardProps) {
    const config = item.config || {}
    const mode = config.mode || 'continuous'
    const equipment = config.equipment as string | undefined
    const equipmentLabel = equipment ? (EQUIPMENT_LABELS[equipment] || equipment) : null
    const EquipmentIcon = equipment ? (EQUIPMENT_ICONS[equipment] || Activity) : null
    const isInterval = mode === 'interval' && config.intervals
    const isPhased = mode === 'phased' && Array.isArray(config.segments) && config.segments.length > 0

    return (
        <div
            style={{
                backgroundColor: colors.bgCard,
                border: `1px solid ${colors.bgCardBorder}`,
                borderRadius: spacing.cardBorderRadius,
                padding: spacing.cardPadding,
                marginBottom: spacing.cardMarginBottom,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
        >
            {/* Header: icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color="#06b6d4" strokeWidth={2.5} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                    Aeróbio
                </span>
            </div>

            {isPhased ? (
                <PhasedContent
                    config={config}
                    equipmentLabel={equipmentLabel}
                    EquipmentIcon={EquipmentIcon}
                />
            ) : isInterval ? (
                <IntervalContent
                    config={config}
                    equipmentLabel={equipmentLabel}
                    EquipmentIcon={EquipmentIcon}
                />
            ) : (
                <ContinuousContent
                    config={config}
                    equipmentLabel={equipmentLabel}
                    EquipmentIcon={EquipmentIcon}
                />
            )}

            {/* Progressão semanal: o preview mostra a semana 1 (base) */}
            {(() => {
                const lastWeek = maxProgressionWeek(config as CardioConfig)
                return lastWeek ? (
                    <div style={{ marginTop: 4, fontSize: 10, color: colors.textTertiary }}>
                        Progressão semanal até a semana {lastWeek} · exibindo a semana 1
                    </div>
                ) : null
            })()}

            {/* Trainer notes */}
            {config.notes && (
                <div
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: colors.textTertiary,
                        fontStyle: 'italic',
                        lineHeight: '16px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {config.notes}
                </div>
            )}
        </div>
    )
}

function PhasedContent({
    config,
    equipmentLabel,
    EquipmentIcon,
}: {
    config: Record<string, any>
    equipmentLabel: string | null
    EquipmentIcon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | null
}) {
    const segments = (config.segments ?? []) as CardioSegment[]
    const totalSeconds = cardioTotalSeconds(config as CardioConfig)

    return (
        <>
            {(equipmentLabel || totalSeconds > 0) && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {EquipmentIcon && <EquipmentIcon size={12} color={colors.textTertiary} strokeWidth={2} />}
                    <span style={{ fontSize: 11, color: colors.textSecondary }}>
                        {[equipmentLabel, totalSeconds > 0 ? `≈ ${formatEstimatedDuration(totalSeconds)}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </div>
            )}

            {/* Uma linha por fase — o aluno vê a estrutura inteira */}
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {segments.map((segment, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 9, color: colors.textTertiary, fontVariantNumeric: 'tabular-nums', minWidth: 10 }}>
                            {i + 1}
                        </span>
                        <span style={{ fontSize: 11, color: colors.textSecondary }}>
                            {[segment.label, segmentStructureLabel(segment), segment.intensity]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </div>
                ))}
            </div>
        </>
    )
}

function ContinuousContent({
    config,
    equipmentLabel,
    EquipmentIcon,
}: {
    config: Record<string, any>
    equipmentLabel: string | null
    EquipmentIcon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | null
}) {
    // Build: "[icon] Bicicleta · 20 min" or "[icon] Bicicleta · 5 km"
    const parts: string[] = []
    if (equipmentLabel) parts.push(equipmentLabel)

    const objective = config.objective || 'time'
    if (objective === 'distance' && config.distance_km) {
        parts.push(`${config.distance_km} km`)
    } else if (config.duration_minutes) {
        parts.push(`${config.duration_minutes} min`)
    }

    const subtitle = parts.join(' · ')

    return (
        <>
            {subtitle && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {EquipmentIcon && <EquipmentIcon size={12} color={colors.textTertiary} strokeWidth={2} />}
                    <span style={{ fontSize: 11, color: colors.textSecondary }}>{subtitle}</span>
                </div>
            )}
            {config.intensity && (
                <div style={{ marginTop: 3, fontSize: 11, color: colors.textTertiary }}>
                    {config.intensity}
                </div>
            )}
        </>
    )
}

function IntervalContent({
    config,
    equipmentLabel,
    EquipmentIcon,
}: {
    config: Record<string, any>
    equipmentLabel: string | null
    EquipmentIcon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | null
}) {
    const intervals = config.intervals || {}
    const workSeconds = intervals.work_seconds || 30
    const restSeconds = intervals.rest_seconds || 15
    const rounds = intervals.rounds || 8

    const totalSeconds = (workSeconds * rounds) + (restSeconds * Math.max(rounds - 1, 0))
    const estimated = formatEstimatedDuration(totalSeconds)

    return (
        <>
            {/* Equipment line */}
            {equipmentLabel && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {EquipmentIcon && <EquipmentIcon size={12} color={colors.textTertiary} strokeWidth={2} />}
                    <span style={{ fontSize: 11, color: colors.textSecondary }}>{equipmentLabel}</span>
                </div>
            )}

            {/* Protocol line */}
            <div style={{ marginTop: 3, fontSize: 11, color: colors.textSecondary }}>
                {rounds}x ({workSeconds}s ON / {restSeconds}s OFF)
            </div>

            {/* Estimated duration */}
            <div style={{ marginTop: 2, fontSize: 10, color: colors.textTertiary }}>
                ≈ {estimated}
            </div>

            {config.intensity && (
                <div style={{ marginTop: 3, fontSize: 11, color: colors.textTertiary }}>
                    {config.intensity}
                </div>
            )}
        </>
    )
}
