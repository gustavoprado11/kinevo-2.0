'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SkinfoldSite } from '@kinevo/shared/lib/assessment-protocols'

// MIRROR de mobile/components/trainer/assessments/AnatomyDiagram.tsx
// — SVG nativo do DOM em vez de react-native-svg. Path data e marker
// positions copiados literalmente.

type AnatomyView = 'front' | 'back'

interface SiteMarker {
    site: SkinfoldSite
    view: AnatomyView
    cx: number
    cy: number
    label_pt: string
}

const VB_W = 100
const VB_H = 220

const SILHOUETTE_PATH =
    'M50,8 ' +
    'C57,8 62,13 62,21 ' +
    'C62,29 57,34 50,34 ' +
    'C43,34 38,29 38,21 ' +
    'C38,13 43,8 50,8 Z ' +
    'M44,36 H56 L60,46 L72,52 L86,86 L80,92 L72,72 L70,90 L72,140 L66,210 L58,212 L56,160 L50,158 L44,160 L42,212 L34,210 L28,140 L30,90 L28,72 L20,92 L14,86 L28,52 L40,46 Z'

const FRONT_MARKERS: SiteMarker[] = [
    { site: 'chest', view: 'front', cx: 41, cy: 60, label_pt: 'Peitoral' },
    { site: 'abdomen', view: 'front', cx: 50, cy: 95, label_pt: 'Abdominal' },
    { site: 'suprailiac', view: 'front', cx: 60, cy: 88, label_pt: 'Supra-ilíaca' },
    { site: 'thigh', view: 'front', cx: 44, cy: 130, label_pt: 'Coxa' },
    { site: 'biceps', view: 'front', cx: 28, cy: 70, label_pt: 'Bíceps' },
    { site: 'midaxillary', view: 'front', cx: 70, cy: 70, label_pt: 'Axilar média' },
    { site: 'calf', view: 'front', cx: 41, cy: 180, label_pt: 'Panturrilha' },
]

const BACK_MARKERS: SiteMarker[] = [
    { site: 'subscapular', view: 'back', cx: 60, cy: 56, label_pt: 'Subescapular' },
    { site: 'triceps', view: 'back', cx: 30, cy: 70, label_pt: 'Tríceps' },
]

export interface AnatomyDiagramWebProps {
    highlight_site?: SkinfoldSite | null
    initial_view?: AnatomyView
    compact?: boolean
}

// Cores dark-safe via CSS vars — funcionam nos 2 temas dentro do SVG.
const SILHOUETTE_FILL = 'var(--border-subtle)'
const MARKER_ACTIVE = 'var(--text-primary)'
const MARKER_INACTIVE = 'var(--text-quaternary)'

export function AnatomyDiagramWeb({ highlight_site, initial_view, compact }: AnatomyDiagramWebProps) {
    const naturalView = useMemo<AnatomyView>(() => {
        if (!highlight_site) return initial_view ?? 'front'
        return BACK_MARKERS.some(m => m.site === highlight_site) ? 'back' : 'front'
    }, [highlight_site, initial_view])

    const [manualView, setManualView] = useState<AnatomyView>(naturalView)
    const view: AnatomyView = highlight_site ? naturalView : manualView

    useEffect(() => {
        setManualView(naturalView)
    }, [naturalView])

    const markers = view === 'front' ? FRONT_MARKERS : BACK_MARKERS
    const activeMarker = markers.find(m => m.site === highlight_site)

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                width={140}
                height={280}
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                aria-label={
                    activeMarker
                        ? `Diagrama anatômico — ${activeMarker.label_pt} destacado`
                        : 'Diagrama anatômico'
                }
            >
                <path
                    d={SILHOUETTE_PATH}
                    fill={SILHOUETTE_FILL}
                    transform={view === 'back' ? 'translate(100,0) scale(-1,1)' : undefined}
                />
                {markers.map(m => {
                    const isActive = m.site === highlight_site
                    return (
                        <circle
                            key={`${m.view}-${m.site}`}
                            cx={m.cx}
                            cy={m.cy}
                            r={isActive ? 4.5 : 2.2}
                            fill={isActive ? MARKER_ACTIVE : MARKER_INACTIVE}
                            stroke={isActive ? MARKER_ACTIVE : 'none'}
                            strokeWidth={isActive ? 1.2 : 0}
                        />
                    )
                })}
            </svg>

            {activeMarker && (
                <span className="text-xs font-semibold text-k-text-primary">
                    {activeMarker.label_pt}
                </span>
            )}

            {!compact && !highlight_site && (
                <div className="flex gap-2">
                    <ToggleButton
                        label="Frente"
                        active={view === 'front'}
                        onClick={() => setManualView('front')}
                    />
                    <ToggleButton
                        label="Costas"
                        active={view === 'back'}
                        onClick={() => setManualView('back')}
                    />
                </div>
            )}
        </div>
    )
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Vista ${label}`}
            aria-pressed={active}
            className={`rounded-control border px-3 py-1 text-xs font-semibold transition-colors ${
                active
                    ? 'border-k-border-primary bg-surface-inset text-k-text-primary'
                    : 'border-k-border-subtle bg-transparent text-k-text-tertiary hover:text-k-text-secondary'
            }`}
        >
            {label}
        </button>
    )
}
