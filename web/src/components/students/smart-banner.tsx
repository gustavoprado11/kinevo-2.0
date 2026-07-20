'use client'

import { useEffect } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { track } from '@/lib/analytics'
import {
    pickBanner,
    type BannerCandidate,
    type BannerContext,
    type BannerLevel,
} from './smart-banner-rules'
import { AssistantMark } from '@/components/assistant/assistant-mark'

interface SmartBannerProps {
    studentId: string
    context: BannerContext
    onAction: (actionId: string) => void
}

interface VariantStyle {
    /** Borda-esquerda de severidade sobre painel hairline neutro. */
    accent: string
    icon: React.ReactNode
}

// Redesign "ferramenta profissional": o banner virou painel hairline com
// borda-esquerda de severidade — sem caixa de ícone preenchida, sem fundo
// tintado. Título/corpo em tinta; a cor fica no acento e no ícone.
const VARIANT_STYLES: Record<BannerLevel, VariantStyle> = {
    critical: {
        accent: 'border-l-red-500',
        icon: <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />,
    },
    high: {
        accent: 'border-l-amber-500',
        icon: <AssistantMark className="w-4 h-4 text-amber-500" aria-hidden="true" />,
    },
    info: {
        accent: 'border-l-blue-500',
        icon: <Info className="w-4 h-4 text-blue-500" aria-hidden="true" />,
    },
}

/**
 * SmartBanner — Onda 3.
 *
 * Renderiza, no máximo, UM banner sobre o dashboard do aluno, escolhido
 * por `pickBanner` a partir do contexto. Quando não há banner aplicável,
 * o componente retorna `null` (banner some quando o aluno está saudável).
 *
 * Telemetria via `track()`:
 *   - `smart_banner_view` ao montar com banner ativo;
 *   - `smart_banner_action` ao clicar em primário/secundário.
 */
export function SmartBanner({ studentId, context, onAction }: SmartBannerProps) {
    const banner = pickBanner(context)
    const bannerKey = banner?.key ?? null

    useEffect(() => {
        if (!banner) return
        track('smart_banner_view', {
            student_id: studentId,
            banner_key: banner.key,
            banner_level: banner.level,
        })
        // bannerKey é o sinal estável (string vs objeto novo a cada render).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bannerKey, studentId])

    if (!banner) return null

    const variant = VARIANT_STYLES[banner.level]

    const handle = (
        actionRole: 'primary' | 'secondary',
        action: BannerCandidate['primary'],
    ) => {
        track('smart_banner_action', {
            student_id: studentId,
            banner_key: banner.key,
            banner_level: banner.level,
            action_role: actionRole,
            action_id: action.actionId,
        })
        onAction(action.actionId)
    }

    return (
        <div
            role="status"
            data-testid="smart-banner"
            data-banner-key={banner.key}
            data-banner-level={banner.level}
            className={`flex items-center gap-3 rounded-panel border border-k-border-subtle border-l-[3px] bg-surface-card px-4 py-3 ${variant.accent}`}
        >
            <div className="shrink-0" aria-hidden="true">
                {variant.icon}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-k-text-primary">{banner.title}</p>
                <p className="mt-0.5 text-xs text-k-text-tertiary">{banner.detail}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {banner.secondary && (
                    <button
                        type="button"
                        onClick={() => handle('secondary', banner.secondary!)}
                        className="px-3 py-1.5 rounded-control text-[11px] font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset transition-colors"
                    >
                        {banner.secondary.label}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => handle('primary', banner.primary)}
                    className="px-3 py-1.5 rounded-control text-[11px] font-semibold text-k-text-primary border border-k-border-primary bg-surface-card hover:bg-surface-inset transition-colors"
                >
                    {banner.primary.label}
                </button>
            </div>
        </div>
    )
}
