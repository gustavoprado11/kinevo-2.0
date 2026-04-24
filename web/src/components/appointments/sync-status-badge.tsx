'use client'

import {
    AlertTriangle,
    CheckCircle2,
    CircleSlash,
    CloudOff,
    Loader2,
} from 'lucide-react'

export type GoogleSyncStatus =
    | 'not_synced'
    | 'pending'
    | 'synced'
    | 'error'
    | 'disabled'
    | null

interface Props {
    status: GoogleSyncStatus
    /** Compact: ícone sem texto. Default: ícone + label curta. */
    compact?: boolean
    className?: string
}

/**
 * Badge visual que indica o estado de sincronização com Google Calendar
 * de uma rotina recorrente. Invisível quando `status === 'not_synced'` ou
 * `null` — não polui o card quando o trainer nem tem Google conectado.
 */
export function SyncStatusBadge({ status, compact, className }: Props) {
    if (!status || status === 'not_synced') return null

    const config = CONFIG[status]

    const base =
        'inline-flex items-center gap-1 rounded text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5'

    if (compact) {
        return (
            <span
                title={config.tooltip}
                aria-label={config.tooltip}
                className={`${base} ${config.classes} ${className ?? ''}`}
            >
                <config.Icon
                    className={`w-2.5 h-2.5 ${config.spin ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                />
            </span>
        )
    }

    return (
        <span
            title={config.tooltip}
            className={`${base} ${config.classes} ${className ?? ''}`}
        >
            <config.Icon
                className={`w-2.5 h-2.5 ${config.spin ? 'animate-spin' : ''}`}
                strokeWidth={2}
            />
            {config.label}
        </span>
    )
}

const CONFIG: Record<
    Exclude<GoogleSyncStatus, null | 'not_synced'>,
    {
        label: string
        tooltip: string
        Icon: typeof CheckCircle2
        classes: string
        spin?: boolean
    }
> = {
    synced: {
        label: 'Google',
        tooltip: 'Sincronizado com Google Calendar',
        Icon: CheckCircle2,
        classes:
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
    pending: {
        label: 'Sincronizando',
        tooltip: 'Aguardando sincronização com Google Calendar',
        Icon: Loader2,
        classes:
            'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
        spin: true,
    },
    error: {
        label: 'Erro sync',
        tooltip: 'Erro ao sincronizar com Google Calendar',
        Icon: AlertTriangle,
        classes:
            'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    },
    disabled: {
        label: 'Off',
        tooltip: 'Sincronização com Google desativada',
        Icon: CircleSlash,
        classes:
            'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-k-text-tertiary',
    },
}

// Helper barrel export for consumers
export { CloudOff }
