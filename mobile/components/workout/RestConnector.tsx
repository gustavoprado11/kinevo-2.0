import { ChevronsDown, Clock } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import type { SetType } from '@kinevo/shared/types/prescription';
import { useV2Colors } from '../../hooks/useV2Colors';

export interface RestConnectorProps {
    /** Descanso em segundos prescrito após a série atual. */
    restSeconds: number;
    /** Tipo da série atual (a que vem antes do connector). */
    currentSetType?: SetType;
    /** Tipo da próxima série (undefined se for a última do exercício). */
    nextSetType?: SetType;
    /** True quando a série atual fecha uma rodada num método composto e há
     *  mais rodadas vindo a seguir. */
    isLastInRound?: boolean;
    /** True quando a série atual é a última do exercício (depois dela vem
     *  outro exercício ou o fim do treino). */
    isLastInExercise?: boolean;
}

type RestFlavor =
    | 'dropImmediate'
    | 'restPause'
    | 'endRound'
    | 'endExercise'
    | 'noRest'
    | 'default';

interface RestVariant {
    label: string;
    flavor: RestFlavor;
}

/**
 * Connector visual que aparece ENTRE séries durante a execução, mostrando o
 * descanso prescrito antes que o aluno marque a série como concluída. O
 * timer overlay continua existindo pra quem clicar em "concluir" — esse
 * connector é informação ambient, não interação.
 *
 * Variantes:
 *   - "Drop imediato · sem descanso" — entre fases drop com 0s
 *   - "Rest-pause · 15s" — entre fases cluster com descanso curto
 *   - "Fim da rodada · 180s" — última fase de rodada não-final em método composto
 *   - "Fim do exercício · 90s descanso" — última fase do exercício
 *   - "Descanso · 60s" — caso geral
 *   - (oculto) — quando não há descanso significativo a comunicar
 */
export function RestConnector({
    restSeconds,
    currentSetType,
    nextSetType,
    isLastInRound = false,
    isLastInExercise = false,
}: RestConnectorProps) {
    const variant = getRestVariant({
        restSeconds,
        currentSetType,
        nextSetType,
        isLastInRound,
        isLastInExercise,
    });
    if (!variant) return null;

    const colors = useV2Colors();
    const styles = getStyleForFlavor(variant.flavor, colors);
    const Icon = variant.flavor === 'dropImmediate' ? ChevronsDown : Clock;

    return (
        <View
            accessibilityRole="text"
            accessibilityLabel={variant.label}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                paddingHorizontal: 4,
            }}
        >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border.default }} />
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: styles.bg,
                    borderWidth: 1,
                    borderColor: styles.border,
                    marginHorizontal: 8,
                }}
            >
                <Icon size={11} color={styles.fg} strokeWidth={2.2} />
                <Text
                    style={{
                        fontSize: 10.5,
                        fontWeight: styles.weight,
                        color: styles.fg,
                        letterSpacing: 0.1,
                    }}
                >
                    {variant.label}
                </Text>
            </View>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border.default }} />
        </View>
    );
}

/* ---------- Lógica do flavor ---------- */

function getRestVariant({
    restSeconds,
    currentSetType,
    nextSetType,
    isLastInRound,
    isLastInExercise,
}: {
    restSeconds: number;
    currentSetType?: SetType;
    nextSetType?: SetType;
    isLastInRound: boolean;
    isLastInExercise: boolean;
}): RestVariant | null {
    const safeRest = Math.max(0, Math.floor(restSeconds || 0));

    // Última série do exercício: só mostra se houver descanso prescrito.
    // Se for 0, não tem o que comunicar (próximo exercício começa direto).
    if (isLastInExercise) {
        if (safeRest <= 0) return null;
        return {
            label: `Fim do exercício · ${safeRest}s descanso`,
            flavor: 'endExercise',
        };
    }

    // Última fase de rodada não-final em método composto.
    if (isLastInRound) {
        if (safeRest <= 0) {
            return { label: 'Fim da rodada · sem descanso', flavor: 'endRound' };
        }
        return { label: `Fim da rodada · ${safeRest}s`, flavor: 'endRound' };
    }

    // Drop imediato: 0s entre fases onde a atual ou a próxima é drop.
    if (safeRest <= 0 && (currentSetType === 'drop' || nextSetType === 'drop')) {
        return { label: 'Drop imediato · sem descanso', flavor: 'dropImmediate' };
    }

    // Rest-pause: descanso curto entre fases de cluster.
    if (
        safeRest > 0 &&
        safeRest < 30 &&
        (currentSetType === 'cluster' || nextSetType === 'cluster')
    ) {
        return { label: `Rest-pause · ${safeRest}s`, flavor: 'restPause' };
    }

    // Sem descanso fora dos contextos de drop/cluster: comunica explicitamente.
    if (safeRest <= 0) {
        return { label: 'Sem descanso', flavor: 'noRest' };
    }

    return { label: `Descanso · ${safeRest}s`, flavor: 'default' };
}

// Estilos por flavor. Rgba pra drop/restPause (alpha-channel funciona em ambos
// modos). Neutrals via tokens da paleta v2 ativa pra endRound/endExercise/
// noRest/default — adaptam automaticamente light/dark.
function getStyleForFlavor(
    flavor: RestFlavor,
    colors: ReturnType<typeof useV2Colors>,
): { bg: string; border: string; fg: string; weight: '600' | '700' } {
    switch (flavor) {
        case 'dropImmediate':
            return {
                bg: 'rgba(244, 63, 94, 0.08)',
                border: 'rgba(244, 63, 94, 0.25)',
                fg: '#be123c',
                weight: '600',
            };
        case 'restPause':
            return {
                bg: 'rgba(124, 58, 237, 0.08)',
                border: 'rgba(124, 58, 237, 0.25)',
                fg: '#6d28d9',
                weight: '600',
            };
        case 'endRound':
        case 'endExercise':
            return {
                bg: colors.neutral[100],
                border: colors.neutral[300],
                fg: colors.text.primary,
                weight: '700',
            };
        case 'noRest':
        case 'default':
        default:
            return {
                bg: colors.surface.card2,
                border: colors.border.default,
                fg: colors.text.secondary,
                weight: '600',
            };
    }
}
