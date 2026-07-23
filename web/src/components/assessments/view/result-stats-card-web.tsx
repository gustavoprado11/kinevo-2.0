'use client'

import {
    classifyBMI,
    classifyWaistHipRatio,
    type Sex,
} from '@kinevo/shared/lib/assessment-protocols'
import type { ComputedMetrics } from '@kinevo/shared/types/assessments'
import { KpiCell } from '@/components/shared/kpi-ruler'

interface ResultStatsCardWebProps {
    metrics: ComputedMetrics | null
    /**
     * Subject sex used for sex-dependent classifications (RCQ). When unknown
     * the component degrades gracefully — RCQ value still shows, but without
     * a category label.
     */
    sex?: Sex | null
}

function fmt(n: number | undefined, digits = 1, suffix = ''): string {
    if (n == null || !Number.isFinite(n)) return '—'
    return `${n.toFixed(digits).replace('.', ',')}${suffix}`
}

function safeBmiLabel(value: number | undefined): string | null {
    if (value == null) return null
    try {
        return classifyBMI(value).label_pt
    } catch {
        return null
    }
}

function safeWhrLabel(value: number | undefined, sex: Sex | null | undefined): string | null {
    if (value == null || !sex) return null
    try {
        return classifyWaistHipRatio(value, sex).label_pt
    } catch {
        return null
    }
}

/**
 * Hero stats grid for the session result page. Three primary KPIs across the
 * top, three secondary (mass) below — régua "ferramenta profissional" via KpiCell.
 */
export function ResultStatsCardWeb({ metrics, sex }: ResultStatsCardWebProps) {
    const m = metrics ?? {}
    const bmi = m.bmi
    const bf = m.body_fat_percent
    const rcq = m.rcq
    const lean = m.lean_mass_kg
    const fat = m.fat_mass_kg
    const density = m.body_density

    return (
        <div className="overflow-hidden rounded-panel border border-k-border-subtle bg-surface-card">
            <header className="border-b border-k-border-subtle px-5 py-4">
                <h3 className="text-sm font-semibold text-k-text-primary">Resultados</h3>
                <p className="mt-0.5 text-xs text-k-text-tertiary">Métricas computadas pelo motor M2</p>
            </header>

            <div className="grid grid-cols-1 gap-px bg-k-border-subtle md:grid-cols-3">
                <KpiCell label="% Gordura Corporal" value={fmt(bf, 1, '%')} />
                <KpiCell label="IMC" value={fmt(bmi, 1)} sub={safeBmiLabel(bmi)} />
                <KpiCell label="RCQ" value={fmt(rcq, 2)} sub={safeWhrLabel(rcq, sex)} />
            </div>

            <div className="grid grid-cols-1 gap-px border-t border-k-border-subtle bg-k-border-subtle md:grid-cols-3">
                <KpiCell label="Massa magra" value={fmt(lean, 1, ' kg')} />
                <KpiCell label="Massa gorda" value={fmt(fat, 1, ' kg')} />
                <KpiCell label="Densidade corporal" value={fmt(density, 4)} />
            </div>
        </div>
    )
}
