import { ChevronsDown, Clock } from 'lucide-react'

import type { SetType } from '@kinevo/shared/types/prescription'

interface PreviewRestConnectorProps {
    /** Descanso em segundos prescrito após a fase atual. */
    restSeconds: number
    /** Tipo da fase atual (a que vem antes do connector). */
    currentSetType?: SetType
    /** Tipo da próxima fase (undefined se for a última do exercício). */
    nextSetType?: SetType
    /** True quando a fase atual fecha uma rodada num método composto e há
     *  mais rodadas vindo a seguir. */
    isLastInRound?: boolean
    /** True quando a fase atual é a última do exercício (depois dela vem
     *  outro exercício ou o fim do treino). */
    isLastInExercise?: boolean
}

type RestFlavor =
    | 'dropImmediate'
    | 'restPause'
    | 'endRound'
    | 'endExercise'
    | 'noRest'
    | 'default'

interface RestVariant {
    label: string
    flavor: RestFlavor
}

/**
 * Espelha mobile/components/workout/RestConnector.tsx no preview do builder.
 * Aparece ENTRE séries pra comunicar o descanso prescrito antes do aluno
 * marcar concluído. Mantém a paridade visual com o que o aluno vê na execução.
 */
export function PreviewRestConnector({
    restSeconds,
    currentSetType,
    nextSetType,
    isLastInRound = false,
    isLastInExercise = false,
}: PreviewRestConnectorProps) {
    const variant = getRestVariant({
        restSeconds,
        currentSetType,
        nextSetType,
        isLastInRound,
        isLastInExercise,
    })
    if (!variant) return null

    const styles = STYLE_BY_FLAVOR[variant.flavor]
    const Icon = variant.flavor === 'dropImmediate' ? ChevronsDown : Clock

    return (
        <div
            aria-label={variant.label}
            style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: 6,
                paddingBottom: 6,
                paddingLeft: 4,
                paddingRight: 4,
            }}
        >
            <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    paddingLeft: 9,
                    paddingRight: 9,
                    paddingTop: 3,
                    paddingBottom: 3,
                    borderRadius: 999,
                    backgroundColor: styles.bg,
                    border: `1px solid ${styles.border}`,
                    marginLeft: 8,
                    marginRight: 8,
                }}
            >
                <Icon size={11} color={styles.fg} strokeWidth={2.2} />
                <span
                    style={{
                        fontSize: 10.5,
                        fontWeight: styles.weight,
                        color: styles.fg,
                        letterSpacing: 0.1,
                    }}
                >
                    {variant.label}
                </span>
            </div>
            <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
        </div>
    )
}

/* ---------- Lógica do flavor (idêntica à mobile) ---------- */

function getRestVariant({
    restSeconds,
    currentSetType,
    nextSetType,
    isLastInRound,
    isLastInExercise,
}: {
    restSeconds: number
    currentSetType?: SetType
    nextSetType?: SetType
    isLastInRound: boolean
    isLastInExercise: boolean
}): RestVariant | null {
    const safeRest = Math.max(0, Math.floor(restSeconds || 0))

    if (isLastInExercise) {
        if (safeRest <= 0) return null
        return {
            label: `Fim do exercício · ${safeRest}s descanso`,
            flavor: 'endExercise',
        }
    }

    if (isLastInRound) {
        if (safeRest <= 0) {
            return { label: 'Fim da rodada · sem descanso', flavor: 'endRound' }
        }
        return { label: `Fim da rodada · ${safeRest}s`, flavor: 'endRound' }
    }

    if (safeRest <= 0 && (currentSetType === 'drop' || nextSetType === 'drop')) {
        return { label: 'Drop imediato · sem descanso', flavor: 'dropImmediate' }
    }

    if (
        safeRest > 0 &&
        safeRest < 30 &&
        (currentSetType === 'cluster' || nextSetType === 'cluster')
    ) {
        return { label: `Rest-pause · ${safeRest}s`, flavor: 'restPause' }
    }

    if (safeRest <= 0) {
        return { label: 'Sem descanso', flavor: 'noRest' }
    }

    return { label: `Descanso · ${safeRest}s`, flavor: 'default' }
}

const STYLE_BY_FLAVOR: Record<
    RestFlavor,
    { bg: string; border: string; fg: string; weight: 600 | 700 }
> = {
    dropImmediate: {
        bg: 'rgba(244, 63, 94, 0.08)',
        border: 'rgba(244, 63, 94, 0.25)',
        fg: '#be123c',
        weight: 600,
    },
    restPause: {
        bg: 'rgba(124, 58, 237, 0.08)',
        border: 'rgba(124, 58, 237, 0.25)',
        fg: '#6d28d9',
        weight: 600,
    },
    endRound: {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        fg: '#1e293b',
        weight: 700,
    },
    endExercise: {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        fg: '#1e293b',
        weight: 700,
    },
    noRest: {
        bg: '#f8fafc',
        border: '#e2e8f0',
        fg: '#475569',
        weight: 600,
    },
    default: {
        bg: '#f8fafc',
        border: '#e2e8f0',
        fg: '#475569',
        weight: 600,
    },
}
