'use client'

import { Activity, Bike, Footprints, Waves, TrendingUp, Zap, Dumbbell } from 'lucide-react'
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

            {isInterval ? (
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
