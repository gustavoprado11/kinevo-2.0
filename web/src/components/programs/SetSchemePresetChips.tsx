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

/**
 * Switcher de método (Fase 4.5d §1, redesign 2026-04):
 *
 *   MÉTODO  [Pirâmide ↓] [Pirâmide ↑] [Drop-set] [Top + backoff] ...
 *
 * - Label "MÉTODO" inline à esquerda, em uppercase tracking-wider, conversa
 *   com os labels do trilho de métricas e da seção da tabela.
 * - Chips inativos: sem fundo, hover sutil. Ativo: violeta (combina com o
 *   chip de método no header do card).
 * - Sem segmented control com fundo cinza — visual mais leve, integrado ao
 *   resto do card.
 * - 6 chips de preset + 1 chip "Customizado" no fim. "Standard" não tem
 *   chip: pra voltar ao modo simples o trainer usa o ícone Sliders no
 *   canto superior do card.
 */
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
                className={
                    active
                        ? 'text-[11.5px] font-semibold px-2.5 py-1 rounded-md transition-colors whitespace-nowrap bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30'
                        : 'text-[11.5px] font-semibold px-2.5 py-1 rounded-md transition-colors whitespace-nowrap text-[var(--text-secondary)] border border-transparent hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]'
                }
            >
                {label}
            </button>
        )
    }

    return (
        <div
            role="group"
            aria-label="Métodos de prescrição"
            className="flex flex-wrap items-center gap-1"
        >
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mr-1.5 shrink-0">
                Método
            </span>
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
