'use client'

import { AlertCircle, BookOpen, Sparkles, X } from 'lucide-react'
import type {
    AssessmentTest,
    BilateralNumericTest,
    ComputedTest,
    MultiAttemptNumericTest,
    NumericUnitTest,
    ProtocolTest,
} from '@kinevo/shared/types/assessments'
import { PROTOCOLS } from '@kinevo/shared/lib/assessment-protocols'

interface TestPropertiesPanelProps {
    test: AssessmentTest | null
    duplicateKey: boolean
    onChange: (next: AssessmentTest) => void
    onClose?: () => void
}

const UNIT_OPTIONS: NumericUnitTest['unit'][] = [
    'kg', 'g', 'cm', 'mm', 'm', '%', 's', 'ms', 'reps', 'rpm', 'w', 'kg/m²',
]

const SELECTION_STRATEGIES: MultiAttemptNumericTest['selection_strategy'][] = [
    'best_max', 'best_min', 'median', 'mean',
]

const STRATEGY_LABELS: Record<MultiAttemptNumericTest['selection_strategy'], string> = {
    best_max: 'Melhor (máximo)',
    best_min: 'Melhor (mínimo)',
    median: 'Mediana',
    mean: 'Média',
}

export function TestPropertiesPanel({
    test,
    duplicateKey,
    onChange,
    onClose,
}: TestPropertiesPanelProps) {
    return (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card">
            <header className="flex flex-shrink-0 items-center justify-between border-b border-k-border-subtle px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                    Propriedades
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar painel"
                        className="rounded-md p-1 text-k-text-tertiary hover:bg-surface-inset hover:text-k-text-primary"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-4">
                {!test ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <div className="rounded-full bg-violet-500/10 p-3">
                            <AlertCircle className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                        </div>
                        <div className="text-sm font-medium text-k-text-primary">Nenhum teste selecionado</div>
                        <p className="max-w-[220px] text-xs text-k-text-tertiary">
                            Clique em um teste no canvas para editar suas propriedades.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Field label="Tipo">
                            <span className="text-sm text-k-text-secondary">{TYPE_DESCRIPTIONS[test.type]}</span>
                        </Field>

                        <Field label="Rótulo exibido">
                            <input
                                type="text"
                                value={test.label}
                                onChange={e => onChange({ ...test, label: e.target.value })}
                                className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                            />
                        </Field>

                        {/* metric_key — applies to every type except protocol
                            (protocols are identified by their `protocol` id;
                            measurements are produced under fixed keys like
                            body_fat_percent / body_density). */}
                        {test.type !== 'protocol' && (
                            <Field
                                label="Chave da métrica"
                                hint="Identificador único usado nas medições. Não pode ter espaços."
                                error={duplicateKey ? 'Esta chave já é usada em outro teste' : undefined}
                            >
                                <input
                                    type="text"
                                    value={(test as { metric_key?: string }).metric_key ?? ''}
                                    onChange={e => {
                                        const sanitized = e.target.value.replace(/\s+/g, '_').toLowerCase()
                                        onChange({ ...test, metric_key: sanitized } as AssessmentTest)
                                    }}
                                    className={`w-full rounded-md border bg-surface-inset px-2.5 py-1.5 font-mono text-sm focus:outline-none ${
                                        duplicateKey
                                            ? 'border-red-500 focus:border-red-500'
                                            : 'border-k-border-subtle focus:border-violet-500'
                                    }`}
                                />
                            </Field>
                        )}

                        {test.type === 'numeric_unit' && (
                            <NumericUnitFields test={test} onChange={onChange} />
                        )}
                        {test.type === 'bilateral_numeric' && (
                            <BilateralFields test={test} onChange={onChange} />
                        )}
                        {test.type === 'multi_attempt_numeric' && (
                            <MultiAttemptFields test={test} onChange={onChange} />
                        )}
                        {test.type === 'computed' && (
                            <ComputedFields test={test} />
                        )}
                        {test.type === 'protocol' && (
                            <ProtocolFields test={test} />
                        )}
                    </div>
                )}
            </div>
        </aside>
    )
}

const TYPE_DESCRIPTIONS: Record<AssessmentTest['type'], string> = {
    numeric_unit: 'Numérico — uma medida com unidade',
    bilateral_numeric: 'Bilateral — direito e esquerdo',
    multi_attempt_numeric: 'Múltiplas tentativas — guarda todas, seleciona uma',
    computed: 'Calculado — valor derivado de outras medições',
    protocol: 'Protocolo — pacote validado de cálculo',
}

function Field({
    label,
    hint,
    error,
    children,
}: {
    label: string
    hint?: string
    error?: string
    children: React.ReactNode
}) {
    return (
        <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                {label}
            </label>
            {children}
            {hint && !error && (
                <div className="mt-1 text-[11px] text-k-text-quaternary">{hint}</div>
            )}
            {error && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                </div>
            )}
        </div>
    )
}

function UnitSelect<T extends { unit: NumericUnitTest['unit'] }>({
    value,
    onChange,
}: {
    value: T['unit']
    onChange: (u: T['unit']) => void
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value as T['unit'])}
            className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
        >
            {UNIT_OPTIONS.map(u => (
                <option key={u} value={u}>{u}</option>
            ))}
        </select>
    )
}

function RequiredToggle({
    value,
    onChange,
}: {
    value: boolean
    onChange: (v: boolean) => void
}) {
    return (
        <label className="flex items-center gap-2 text-sm text-k-text-secondary">
            <input
                type="checkbox"
                checked={value}
                onChange={e => onChange(e.target.checked)}
                className="h-4 w-4 rounded border-k-border-primary text-violet-500 focus:ring-violet-500"
            />
            Obrigatório
        </label>
    )
}

function numberOrUndef(v: string): number | undefined {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
}

function NumericUnitFields({
    test,
    onChange,
}: {
    test: NumericUnitTest
    onChange: (next: AssessmentTest) => void
}) {
    return (
        <>
            <Field label="Unidade">
                <UnitSelect<NumericUnitTest> value={test.unit} onChange={u => onChange({ ...test, unit: u })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Mínimo">
                    <input
                        type="number"
                        value={test.min ?? ''}
                        onChange={e => onChange({ ...test, min: numberOrUndef(e.target.value) })}
                        className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                    />
                </Field>
                <Field label="Máximo">
                    <input
                        type="number"
                        value={test.max ?? ''}
                        onChange={e => onChange({ ...test, max: numberOrUndef(e.target.value) })}
                        className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                    />
                </Field>
            </div>
            <Field label="Dica (opcional)">
                <input
                    type="text"
                    value={test.hint ?? ''}
                    onChange={e => onChange({ ...test, hint: e.target.value || undefined })}
                    className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                />
            </Field>
            <RequiredToggle value={test.required === true} onChange={v => onChange({ ...test, required: v })} />
        </>
    )
}

function BilateralFields({
    test,
    onChange,
}: {
    test: BilateralNumericTest
    onChange: (next: AssessmentTest) => void
}) {
    return (
        <>
            <Field label="Unidade">
                <UnitSelect<BilateralNumericTest> value={test.unit} onChange={u => onChange({ ...test, unit: u })} />
            </Field>
            <RequiredToggle value={test.required === true} onChange={v => onChange({ ...test, required: v })} />
        </>
    )
}

function MultiAttemptFields({
    test,
    onChange,
}: {
    test: MultiAttemptNumericTest
    onChange: (next: AssessmentTest) => void
}) {
    return (
        <>
            <Field label="Unidade">
                <UnitSelect<MultiAttemptNumericTest> value={test.unit} onChange={u => onChange({ ...test, unit: u })} />
            </Field>
            <Field label="Número de tentativas">
                <input
                    type="number"
                    min={1}
                    max={10}
                    value={test.attempts}
                    onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        if (Number.isFinite(n) && n >= 1 && n <= 10) {
                            onChange({ ...test, attempts: n })
                        }
                    }}
                    className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                />
            </Field>
            <Field label="Estratégia de seleção">
                <select
                    value={test.selection_strategy}
                    onChange={e =>
                        onChange({
                            ...test,
                            selection_strategy: e.target.value as MultiAttemptNumericTest['selection_strategy'],
                        })
                    }
                    className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-1.5 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                >
                    {SELECTION_STRATEGIES.map(s => (
                        <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                    ))}
                </select>
            </Field>
        </>
    )
}

function ComputedFields({ test }: { test: ComputedTest }) {
    return (
        <>
            <Field label="Fórmula">
                <code className="block rounded-md bg-surface-inset px-2.5 py-1.5 font-mono text-sm text-k-text-secondary">
                    {test.formula_id}
                </code>
            </Field>
            <Field label="Inputs requeridos" hint="Estas chaves precisam estar presentes em outros testes da avaliação.">
                <div className="flex flex-wrap gap-1.5">
                    {test.inputs.map(i => (
                        <code
                            key={i}
                            className="rounded-md bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-500 dark:text-violet-400"
                        >
                            {i}
                        </code>
                    ))}
                </div>
            </Field>
        </>
    )
}

const SITE_LABELS_PT: Record<string, string> = {
    chest: 'Peitoral',
    abdomen: 'Abdominal',
    thigh: 'Coxa',
    triceps: 'Tríceps',
    subscapular: 'Subescapular',
    suprailiac: 'Suprailíaca',
    midaxillary: 'Axilar média',
    calf: 'Panturrilha',
    biceps: 'Bíceps',
}

function ProtocolFields({ test }: { test: ProtocolTest }) {
    const def = PROTOCOLS[test.protocol]
    if (!def) {
        return (
            <Field label="Protocolo">
                <code className="block rounded-md bg-surface-inset px-2.5 py-1.5 font-mono text-sm text-k-text-secondary">
                    {test.protocol}
                </code>
            </Field>
        )
    }

    const male = def.required_sites.find(r => r.sex === 'male')?.sites ?? []
    const female = def.required_sites.find(r => r.sex === 'female')?.sites ?? []
    const sameAcrossSex =
        male.length === female.length && male.every((s, i) => s === female[i])

    // Outputs: density-based protocols compute body_density first, then derive
    // %BG and the mass split. Non-density protocols (Faulkner) return %BG
    // directly. The mobile finalize chains lean/fat mass when weight is
    // present.
    const outputs = def.computes_density
        ? ['Densidade corporal', '% Gordura', 'Massa magra (kg)', 'Massa gorda (kg)']
        : ['% Gordura', 'Massa magra (kg)', 'Massa gorda (kg)']

    return (
        <div className="space-y-4">
            <Field label="Protocolo">
                <div className="rounded-md border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
                    <div className="text-sm font-semibold text-k-text-primary">{def.name_pt}</div>
                    <p className="mt-1 text-xs leading-relaxed text-k-text-secondary">
                        {def.description_pt}
                    </p>
                </div>
            </Field>

            <Field label="Coleta os seguintes pontos">
                {sameAcrossSex ? (
                    <SiteList sites={male} />
                ) : (
                    <div className="space-y-3">
                        <SiteListByGroup label="Masculino" sites={male} />
                        <SiteListByGroup label="Feminino" sites={female} />
                    </div>
                )}
            </Field>

            <Field label="Calcula">
                <ul className="space-y-1.5">
                    {outputs.map(o => (
                        <li
                            key={o}
                            className="flex items-center gap-2 text-sm text-k-text-secondary"
                        >
                            <Sparkles className="h-3 w-3 flex-shrink-0 text-violet-500 dark:text-violet-400" />
                            {o}
                        </li>
                    ))}
                </ul>
            </Field>

            <div className="rounded-md border border-k-border-subtle bg-surface-inset px-3 py-2">
                <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 h-3 w-3 flex-shrink-0 text-k-text-quaternary" />
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                            Fonte
                        </div>
                        <p className="mt-0.5 italic leading-relaxed text-[11px] text-k-text-tertiary">
                            {def.source_citation}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SiteList({ sites }: { sites: string[] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {sites.map(s => (
                <span
                    key={s}
                    className="rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-500 dark:text-violet-400"
                >
                    {SITE_LABELS_PT[s] ?? s}
                </span>
            ))}
        </div>
    )
}

function SiteListByGroup({ label, sites }: { label: string; sites: string[] }) {
    return (
        <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-k-text-quaternary">
                {label}
            </div>
            <SiteList sites={sites} />
        </div>
    )
}
