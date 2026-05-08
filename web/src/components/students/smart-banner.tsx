'use client'

import { useEffect } from 'react'
import { AlertTriangle, Sparkles, Info } from 'lucide-react'
import { track } from '@/lib/analytics'
import {
    pickBanner,
    type BannerCandidate,
    type BannerContext,
    type BannerLevel,
} from './smart-banner-rules'

interface SmartBannerProps {
    studentId: string
    context: BannerContext
    onAction: (actionId: string) => void
}

interface VariantStyle {
    container: string
    iconBox: string
    icon: React.ReactNode
    primaryButton: string
    secondaryButton: string
    title: string
    detail: string
}

const VARIANT_STYLES: Record<BannerLevel, VariantStyle> = {
    critical: {
        container: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
        iconBox: 'bg-red-500',
        icon: <AlertTriangle className="w-5 h-5 text-white" aria-hidden="true" />,
        primaryButton:
            'bg-red-600 hover:bg-red-500 text-white border-transparent shadow-sm',
        secondaryButton:
            'bg-transparent text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40 hover:bg-red-100 dark:hover:bg-red-500/15',
        title: 'text-red-700 dark:text-red-300',
        detail: 'text-red-700/80 dark:text-red-200/80',
    },
    high: {
        container:
            'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
        iconBox: 'bg-amber-500',
        icon: <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />,
        primaryButton:
            'bg-amber-500 hover:bg-amber-400 text-white border-transparent shadow-sm',
        secondaryButton:
            'bg-transparent text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-500/15',
        title: 'text-amber-700 dark:text-amber-300',
        detail: 'text-amber-700/80 dark:text-amber-200/80',
    },
    info: {
        container: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
        iconBox: 'bg-blue-500',
        icon: <Info className="w-5 h-5 text-white" aria-hidden="true" />,
        primaryButton:
            'bg-blue-600 hover:bg-blue-500 text-white border-transparent shadow-sm',
        secondaryButton:
            'bg-transparent text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-500/15',
        title: 'text-blue-700 dark:text-blue-300',
        detail: 'text-blue-700/80 dark:text-blue-200/80',
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
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${variant.container}`}
        >
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${variant.iconBox}`}
                aria-hidden="true"
            >
                {variant.icon}
            </div>

            <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${variant.title}`}>{banner.title}</p>
                <p className={`mt-0.5 text-xs ${variant.detail}`}>{banner.detail}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {banner.secondary && (
                    <button
                        type="button"
                        onClick={() => handle('secondary', banner.secondary!)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${variant.secondaryButton}`}
                    >
                        {banner.secondary.label}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => handle('primary', banner.primary)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${variant.primaryButton}`}
                >
                    {banner.primary.label}
                </button>
            </div>
        </div>
    )
}
