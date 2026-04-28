'use client'

import type { MethodKey } from '@kinevo/shared/types/prescription'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'

interface SetSchemePresetChipsProps {
    activeKey: MethodKey | null
    /** Aplica um preset (sobrescreve scheme + rounds) ou marca o item como
     *  Customizado (`'custom'` — preserva scheme + rounds, só rotula). */
    onApply: (key: Exclude<MethodKey, 'standard'>) => void
}

const PRESET_ORDER: Array<Exclude<MethodKey, 'standard' | 'custom'>> = [
    'pyramid_down',
    'pyramid_up',
    'drop_set',
    'top_backoff',
    '5x5',
    'cluster',
]

/** Segmented control unificado (Fase 4.5d §1):
 *  - 6 chips de preset + 1 chip "Customizado" sempre visível no fim.
 *  - Chip ativo: fundo sólido violet/azul, texto branco, sombra sutil.
 *  - Chip inativo: fundo transparente sobre o container cinza, texto neutro.
 *  - O 7º chip "Customizado" é manualmente clicável e preserva `set_scheme`/
 *    `rounds` — só rotula a intenção do trainer. */
export function SetSchemePresetChips({ activeKey, onApply }: SetSchemePresetChipsProps) {
    const renderChip = (
        key: Exclude<MethodKey, 'standard'>,
        label: string,
        title?: string,
    ) => {
        const active = activeKey === key
        return (
            <button
                key={key}
                type="button"
                onClick={() => onApply(key)}
                title={title ?? label}
                aria-pressed={active}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                    active
                        ? 'bg-[#007AFF] dark:bg-violet-600 text-white shadow-sm'
                        : 'bg-transparent text-zinc-700 dark:text-zinc-300 hover:text-[#007AFF] dark:hover:text-violet-300'
                }`}
            >
                {label}
            </button>
        )
    }

    return (
        <div
            role="group"
            aria-label="Presets de método"
            className="inline-flex flex-wrap items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5"
        >
            {PRESET_ORDER.map((key) => {
                const preset = SYSTEM_PRESETS[key]
                return renderChip(key, preset.name, preset.description)
            })}
            {renderChip(
                'custom',
                'Customizado',
                'Mantém a estrutura atual e rotula como Customizado',
            )}
        </div>
    )
}
