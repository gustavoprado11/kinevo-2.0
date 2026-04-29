import { colors, spacing, typography } from './preview-design-tokens'
import type { SetType } from '@kinevo/shared/types/prescription'
import { buildWeightMetaLabel } from '@kinevo/shared/lib/prescription/set-scheme'
import { buildSetMetaLabel, isAmrapReps } from '@kinevo/shared/lib/prescription/set-meta-label'
import type { PreviewPhase } from './builder-to-preview'

interface PreviewSetRowProps {
    index: number
    /** Per-phase prescription (Fase 4.5e). NULL for legacy items without
     *  set_scheme — row renders in legacy mode (no border, no meta labels). */
    phase?: PreviewPhase | null
}

/** Tailwind-compatible hex per set type. Mirrors mobile SetTypeBorder
 *  (Fase 4.5c §4) and the web SetSchemeTable border palette. */
const SET_TYPE_BORDER: Record<SetType, string | null> = {
    normal: null,
    warmup: '#a1a1aa',
    top: '#fb923c',
    backoff: '#38bdf8',
    drop: '#f43f5e',
    failure: '#dc2626',
    cluster: '#8b5cf6',
    amrap: '#3b82f6',
}

const META_LABEL_COLOR = '#7c3aed'

// `isAmrapReps` agora vem do shared (set-meta-label) — cobre AMRAP, falha e
// máximo num só lugar pra UI do builder e a execução baterem. `isClusterReps`
// ficou sem uso depois que o placeholder passou a respeitar o input do
// trainer literal — nada de sobrescrever "5+5+5" com nada sintético.

export function PreviewSetRow({ index, phase }: PreviewSetRowProps) {
    const target = (phase?.repsTarget ?? '').trim()
    const hasTarget = target.length > 0
    const setType: SetType = phase?.setType ?? 'normal'
    const amrap = setType === 'amrap' || (hasTarget && isAmrapReps(target))

    // Fase 4.5f: meta line uses the shared helper so RIR + Tempo show up
    // alongside reps. Synthesize "AMRAP" when set_type forces it but the
    // reps target doesn't already say so — keeps legacy detection rule.
    // Sintetiza "AMRAP" ou "falha" pra que buildSetMetaLabel produza
    // "Meta: até a falha" sem depender do trainer ter digitado essa palavra
    // no campo reps. Espelha mobile/components/workout/SetRow.tsx.
    const metaInputReps = (() => {
        if (isAmrapReps(target)) return target
        if (setType === 'amrap') return 'AMRAP'
        if (setType === 'failure') return 'falha'
        return target
    })()
    const repsMetaLabelRaw = buildSetMetaLabel({
        reps: metaInputReps,
        rir: phase?.rir ?? null,
        tempo: phase?.tempo ?? null,
    })
    const repsMetaLabel = repsMetaLabelRaw.length > 0 ? repsMetaLabelRaw : null

    // Prioridade: o que o trainer digitou ganha sempre. Só sintetiza
    // "AMRAP" como placeholder quando reps está vazio mas o tipo é amrap —
    // dá pista visual sem sobrescrever a intenção do trainer (ex: ele
    // digitou "Máximo" e queria ver "Máximo", não "AMRAP").
    const repsPlaceholder = (() => {
        if (hasTarget) return target
        if (amrap) return 'AMRAP'
        return ''
    })()

    const weightMetaLabel = phase
        ? buildWeightMetaLabel(phase.weightTargetKg, phase.weightTargetPct1rm)
        : null

    const weightPlaceholder = (() => {
        if (phase?.weightTargetKg !== null && phase?.weightTargetKg !== undefined) {
            return Number.isInteger(phase.weightTargetKg)
                ? String(phase.weightTargetKg)
                : phase.weightTargetKg.toFixed(1).replace(/\.0$/, '')
        }
        return 'kg'
    })()

    const borderColor = SET_TYPE_BORDER[setType]

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: spacing.setRowPaddingV,
                paddingBottom: spacing.setRowPaddingV,
                paddingLeft: borderColor ? spacing.setRowPaddingH + 2 : spacing.setRowPaddingH,
                paddingRight: spacing.setRowPaddingH,
                borderRadius: spacing.setRowBorderRadius,
                marginBottom: spacing.setRowMarginBottom,
                borderLeftWidth: borderColor ? 3 : 0,
                borderLeftStyle: borderColor ? 'solid' : 'none',
                borderLeftColor: borderColor ?? 'transparent',
            }}
        >
            {/* Set Number Badge */}
            <div
                style={{
                    width: spacing.setBadgeSize,
                    height: spacing.setBadgeSize,
                    borderRadius: spacing.setBadgeSize / 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                    backgroundColor: colors.bgSetBadge,
                    flexShrink: 0,
                }}
            >
                <span style={{ fontSize: typography.setNumber.fontSize, fontWeight: typography.setNumber.fontWeight, color: colors.textSecondary }}>
                    {index + 1}
                </span>
            </div>

            {/* Previous Data */}
            <div style={{ width: spacing.previousColWidth, textAlign: 'center', marginRight: 6, flexShrink: 0 }}>
                <span style={{ fontSize: typography.previousData.fontSize, fontWeight: typography.previousData.fontWeight, color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                    —
                </span>
            </div>

            {/* Weight cell — stacks Meta label above input when prescribed */}
            <div style={{ flex: 1, marginRight: 6, display: 'flex', flexDirection: 'column' }}>
                {weightMetaLabel ? (
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: META_LABEL_COLOR,
                            textAlign: 'center',
                            marginBottom: 2,
                            letterSpacing: 0.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {weightMetaLabel}
                    </span>
                ) : null}
                <div
                    style={{
                        height: spacing.inputHeight,
                        backgroundColor: colors.bgInput,
                        borderRadius: spacing.inputBorderRadius,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <span
                        style={{
                            fontSize: typography.inputText.fontSize,
                            fontWeight: typography.inputText.fontWeight,
                            color: weightMetaLabel ? 'rgba(124, 58, 237, 0.55)' : colors.textQuaternary,
                        }}
                    >
                        {weightPlaceholder}
                    </span>
                </div>
            </div>

            {/* Reps cell — stacks Meta label above input when prescribed.
             *  Fase 4.5f: meta can include "· RIR · Tempo".
             *  Fase 4.5g: removed `-webkit-line-clamp` — esconder informação
             *  prescrita era pior que deixar a linha quebrar livremente.
             *  Renders as a regular block; wraps em N linhas conforme couber.
             *  `word-break: break-word` evita overflow horizontal em mocks
             *  estreitos sem precisar truncar. */}
            <div style={{ flex: 1, marginRight: 6, display: 'flex', flexDirection: 'column' }}>
                {repsMetaLabel ? (
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: META_LABEL_COLOR,
                            textAlign: 'center',
                            marginBottom: 2,
                            letterSpacing: 0.2,
                            lineHeight: 1.2,
                            wordBreak: 'break-word',
                        }}
                    >
                        {repsMetaLabel}
                    </span>
                ) : null}
                <div
                    style={{
                        height: spacing.inputHeight,
                        backgroundColor: colors.bgInput,
                        borderRadius: spacing.inputBorderRadius,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <span
                        style={{
                            fontSize: typography.inputText.fontSize,
                            fontWeight: typography.inputText.fontWeight,
                            color: repsPlaceholder ? 'rgba(124, 58, 237, 0.55)' : colors.textQuaternary,
                        }}
                    >
                        {repsPlaceholder || ' '}
                    </span>
                </div>
            </div>

            {/* Check Button */}
            <div
                style={{
                    width: spacing.checkBtnSize,
                    height: spacing.checkBtnSize,
                    borderRadius: spacing.checkBtnSize / 2,
                    backgroundColor: colors.bgCheckDefault,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        width: spacing.checkIconSize,
                        height: spacing.checkIconSize,
                        borderRadius: spacing.checkIconSize / 2,
                        border: `2px solid ${colors.bgCheckCircleBorder}`,
                    }}
                />
            </div>
        </div>
    )
}
