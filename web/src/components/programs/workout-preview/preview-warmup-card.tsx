'use client'

import { Flame } from 'lucide-react'
import type { PreviewWarmupCardio } from './builder-to-preview'
import { colors, spacing } from './preview-design-tokens'

const WARMUP_TYPE_LABELS: Record<string, string> = {
    free: 'Livre',
    light_cardio: 'Cardio leve',
    mobility: 'Mobilidade',
    activation: 'Ativação',
}

interface PreviewWarmupCardProps {
    item: PreviewWarmupCardio
}

export function PreviewWarmupCard({ item }: PreviewWarmupCardProps) {
    const config = item.config || {}
    const warmupType = config.warmup_type || 'free'
    const typeLabel = WARMUP_TYPE_LABELS[warmupType] || warmupType
    const duration = config.duration_minutes
    const description = config.description

    // Build subtitle: "Cardio leve · 5 min" or "Livre" or "Mobilidade · 10 min"
    const subtitleParts: string[] = [typeLabel]
    if (duration) subtitleParts.push(`${duration} min`)
    const subtitle = subtitleParts.join(' · ')

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
                <Flame size={14} color="#f59e0b" strokeWidth={2.5} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                    Aquecimento
                </span>
            </div>

            {/* Subtitle: type + duration */}
            <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary }}>
                {subtitle}
            </div>

            {/* Description (if exists) */}
            {description && (
                <div
                    style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: colors.textTertiary,
                        lineHeight: '16px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {description}
                </div>
            )}
        </div>
    )
}
