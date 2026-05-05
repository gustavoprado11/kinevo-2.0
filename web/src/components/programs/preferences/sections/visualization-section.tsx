'use client'

import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type { DefaultView } from '@/types/prescription-preferences'
import { ChipRow, type ChipOption } from '../chip-row'
import { CollapsibleSection } from '../collapsible-section'
import { usePreferenceSaver } from '../use-preference-saver'

const VIEW_OPTIONS: ChipOption<DefaultView>[] = [
    { value: 'preview', label: 'Mock' },
    { value: 'compare', label: 'Comparador' },
    { value: 'ai_prescribe', label: 'Texto' },
    { value: 'normal', label: 'Checklist' },
]

export function VisualizationSection() {
    const visualization = usePrescriptionPreferencesStore((s) => s.preferences.visualization)
    const savePatch = usePreferenceSaver()

    return (
        <CollapsibleSection title="Visualização">
            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">View padrão</label>
                <ChipRow
                    options={VIEW_OPTIONS}
                    value={visualization.default_view}
                    onChange={(next) => savePatch({ visualization: { default_view: next } })}
                    ariaLabel="View padrão da prescrição"
                />
            </div>

            <div className="flex items-start justify-between gap-4 pt-1">
                <div className="flex-1">
                    <label htmlFor="library-open-toggle" className="block text-sm text-k-text-primary cursor-pointer">
                        Biblioteca aberta ao entrar
                    </label>
                    <p className="text-xs text-k-text-tertiary mt-0.5">
                        Abre o painel de exercícios automaticamente.
                    </p>
                </div>
                <button
                    id="library-open-toggle"
                    type="button"
                    role="switch"
                    aria-checked={visualization.library_open_on_enter}
                    onClick={() => {
                        savePatch({
                            visualization: { library_open_on_enter: !visualization.library_open_on_enter },
                        })
                        // Limpa o "manual override" anterior salvo pelo toggle do builder,
                        // pra que o próximo refresh respeite a nova pref. Sem isto, o
                        // localStorage venceria a pref e a mudança parecia não ter efeito.
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('kinevo-library-collapsed')
                        }
                    }}
                    className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        visualization.library_open_on_enter ? 'bg-violet-600' : 'bg-k-border-primary'
                    }`}
                >
                    <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            visualization.library_open_on_enter ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                    />
                </button>
            </div>
        </CollapsibleSection>
    )
}
