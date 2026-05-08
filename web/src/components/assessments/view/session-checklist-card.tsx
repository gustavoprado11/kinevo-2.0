'use client'

import { Check, CircleDashed } from 'lucide-react'
import type {
    AssessmentMeasurement,
    AssessmentTemplateSchema,
    AssessmentTest,
} from '@kinevo/shared/types/assessments'

interface SessionChecklistCardProps {
    schema: AssessmentTemplateSchema | null
    measurements: AssessmentMeasurement[]
}

/**
 * Read-only checklist of every test in a session's template, marked as
 * captured/pending based on whether at least one measurement exists for the
 * test's metric_key. Used on the session detail page.
 */
export function SessionChecklistCard({ schema, measurements }: SessionChecklistCardProps) {
    if (!schema || !schema.sections?.length) {
        return (
            <div className="rounded-2xl border border-k-border-subtle bg-surface-card p-5 text-center">
                <p className="text-sm text-k-text-tertiary">Sem template anexado.</p>
            </div>
        )
    }

    const captured = new Set(
        measurements
            .filter(m => m.is_selected !== false)
            .map(m => m.metric_key),
    )

    const totals = schema.sections.reduce(
        (acc, sec) => {
            for (const t of sec.tests) {
                acc.total += 1
                if (isTestCaptured(t, captured)) acc.done += 1
            }
            return acc
        },
        { total: 0, done: 0 },
    )

    const pct = totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100)

    return (
        <div className="overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card">
            <header className="flex items-center justify-between border-b border-k-border-subtle px-5 py-4">
                <div>
                    <h3 className="text-sm font-semibold text-k-text-primary">Checklist da avaliação</h3>
                    <p className="mt-0.5 text-xs text-k-text-tertiary">
                        {totals.done} de {totals.total} testes capturados
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-xl font-bold text-violet-500 dark:text-violet-400">{pct}%</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-inset">
                        <div
                            className="h-full rounded-full bg-violet-500 transition-all dark:bg-violet-400"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </header>

            <div className="divide-y divide-k-border-subtle">
                {schema.sections.map(section => (
                    <div key={section.id} className="px-5 py-4">
                        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                            {section.title}
                        </h4>
                        <ul className="space-y-2">
                            {section.tests.map(test => {
                                const done = isTestCaptured(test, captured)
                                return (
                                    <li key={test.id} className="flex items-center gap-3">
                                        <span
                                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                                                done
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-surface-inset text-k-text-quaternary'
                                            }`}
                                        >
                                            {done ? <Check className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                                        </span>
                                        <span
                                            className={`text-sm ${
                                                done ? 'text-k-text-primary' : 'text-k-text-tertiary'
                                            }`}
                                        >
                                            {test.label}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    )
}

function isTestCaptured(test: AssessmentTest, captured: Set<string>): boolean {
    if (test.type === 'protocol') {
        // Protocol tests don't carry a metric_key directly; treat as captured
        // if any computed_* metric is present (rough heuristic). Since the
        // checklist is informational, this is acceptable.
        return captured.has(`protocol:${test.protocol}`) || captured.has('body_fat_percent')
    }
    const key = (test as { metric_key?: string }).metric_key
    return key ? captured.has(key) : false
}
