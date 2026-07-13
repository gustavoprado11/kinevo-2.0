import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { SetType } from '@kinevo/shared/types/prescription';
import {
    buildWeightMetaLabel,
    formatWeightKg,
} from '@kinevo/shared/lib/prescription/set-scheme';
import { buildSetMetaLabel, isAmrapReps } from '@kinevo/shared/lib/prescription/set-meta-label';
import { SetTypeBadge } from './SetTypeBadge';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

interface SetRowProps {
    index: number;
    weight: string;
    reps: string;
    isCompleted: boolean;
    onWeightChange: (value: string) => void;
    onRepsChange: (value: string) => void;
    onToggleComplete: () => void;
    previousWeight?: number;
    previousReps?: number;
    /** Per-set type prescribed by the trainer (badge to the left of #). Defaults to normal. */
    setType?: SetType;
    /** Per-set rep target prescribed by the trainer ("Meta: …" label above the reps input). */
    repsTarget?: string;
    /** Per-set absolute weight target in kg (rendered as "Meta: 80 kg" above the weight input). */
    weightTargetKg?: number | null;
    /** Per-set weight target as % of 1RM (rendered as "Meta: 75% 1RM"; combined with kg when both are set). */
    weightTargetPct1rm?: number | null;
    /** Reps in reserve target (Fase 4.5f). 0 is valid (= "to failure"). */
    rirTarget?: number | null;
    /** Tempo string, e.g. "3-1-1-0" (Fase 4.5f). Empty string treated as not prescribed. */
    tempoTarget?: string | null;
    /** When true, hides inputs / check button — preview / read-only rendering. */
    readOnly?: boolean;
    /** Abre o histórico do exercício. Ausente = coluna "Anterior" não é tocável
     *  (preview do builder, telas sem aluno). */
    onHistoryPress?: () => void;
}

const isClusterReps = (reps: string) => reps.includes('+');
// `isAmrapReps` agora vem do shared (set-meta-label) — cobre AMRAP, falha e
// máximo. Mantido como import pra paridade com PreviewSetRow no web.

export const SetRow = React.memo(function SetRow({
    index,
    weight,
    reps,
    isCompleted,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
    previousWeight,
    previousReps,
    setType = 'normal',
    repsTarget,
    weightTargetKg,
    weightTargetPct1rm,
    rirTarget,
    tempoTarget,
    readOnly = false,
    onHistoryPress,
}: SetRowProps) {
    const colors = useV2Colors();

    const handleHistoryPress = () => {
        if (!onHistoryPress) return;
        Haptics.selectionAsync();
        onHistoryPress();
    };

    const handleToggle = () => {
        if (!isCompleted) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
            Haptics.selectionAsync();
        }
        onToggleComplete();
    };

    const hasPrevious = previousWeight !== undefined && previousReps !== undefined;
    const target = (repsTarget ?? '').trim();
    const hasTarget = target.length > 0;
    const cluster = hasTarget && isClusterReps(target);
    const amrap = setType === 'amrap' || (hasTarget && isAmrapReps(target));

    // Prioridade: input do trainer ganha sempre. Só sintetiza "AMRAP" como
    // placeholder quando reps está vazio mas o tipo é amrap — dá pista
    // visual sem sobrescrever o que o trainer escolheu (ex: ele digitou
    // "Máximo" e o aluno deve ver "Máximo", não "AMRAP").
    const repsPlaceholder = (() => {
        if (hasTarget) return target;
        if (amrap) return 'AMRAP';
        if (hasPrevious) return String(previousReps);
        return '';
    })();

    // Meta label shown above the reps row — unified via shared helper
    // (Fase 4.5f). Includes RIR and Tempo when prescribed. Synthesize an
    // explicit "AMRAP" string when the trainer set `set_type='amrap'` but
    // didn't put AMRAP-y text in `reps` — keeps the legacy detection rule
    // (setType OR reps content) intact.
    // Sintetiza "AMRAP" ou "falha" no input pra que buildSetMetaLabel
    // produza "Meta: até a falha" mesmo quando o trainer não digitou essa
    // palavra no campo reps. Cobre tanto setType='amrap' quanto 'failure'
    // — os dois tipos comunicam a mesma intenção ("vai até não conseguir
    // mais") e o regex em buildSetMetaLabel já reconhece ambos.
    const metaInputReps = (() => {
        if (isAmrapReps(target)) return target;
        if (setType === 'amrap') return 'AMRAP';
        if (setType === 'failure') return 'falha';
        return target;
    })();
    const metaLabelRaw = buildSetMetaLabel({
        reps: metaInputReps,
        rir: rirTarget ?? null,
        tempo: tempoTarget ?? null,
    });
    const metaLabel = metaLabelRaw.length > 0 ? metaLabelRaw : null;

    // Weight meta (kg / %1RM). Optional — null hides the label entirely.
    const weightMetaLabel = buildWeightMetaLabel(weightTargetKg, weightTargetPct1rm);
    const weightTargetKgFormatted = formatWeightKg(weightTargetKg);
    const hasWeightTarget = weightMetaLabel !== null;
    const weightPlaceholder = (() => {
        if (weightTargetKgFormatted !== null) return weightTargetKgFormatted;
        if (hasPrevious) return String(previousWeight);
        return 'kg';
    })();

    return (
        <View>
            <View style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 5,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    marginBottom: 4,
                },
                isCompleted && { backgroundColor: toRgba(colors.purple[600], 0.06) },
            ]}>
                {/* Set Number */}
                <View style={[
                    {
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 6,
                    },
                    isCompleted
                        ? { backgroundColor: toRgba(colors.purple[600], 0.15) }
                        : { backgroundColor: colors.surface.card2 },
                ]}>
                    <Text style={[
                        { fontSize: 12, fontWeight: '600' },
                        isCompleted ? { color: colors.purple[600] } : { color: colors.text.tertiary },
                    ]}>
                        {index + 1}
                    </Text>
                </View>

                {/* Type badge — chip com ícone + label pt-BR à esquerda da
                 *  coluna "Anterior". Antes era compact (só ícone), o que
                 *  deixava o aluno perdido — vermelho/violeta/laranja sem
                 *  legenda nenhuma. Agora a cor segue acompanhando, mas o
                 *  texto explica o que cada uma significa. */}
                {setType !== 'normal' ? (
                    <View style={{ marginRight: 6 }}>
                        <SetTypeBadge setType={setType} />
                    </View>
                ) : null}

                {/* Previous set data — coluna mais estreita quando há badge
                 *  com label, pra absorver os ~50px extras do chip.
                 *  Tocável quando a tela sabe de quem é o histórico: abre as
                 *  últimas execuções do exercício (o número que está aqui é só
                 *  a última). */}
                <TouchableOpacity
                    disabled={!onHistoryPress}
                    onPress={handleHistoryPress}
                    accessibilityRole={onHistoryPress ? 'button' : undefined}
                    accessibilityLabel={onHistoryPress ? 'Ver histórico do exercício' : undefined}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={{
                        width: setType !== 'normal' ? 32 : 58,
                        alignItems: 'center',
                        marginRight: 6,
                        paddingVertical: 2,
                        borderRadius: 7,
                        borderWidth: onHistoryPress ? 1 : 0,
                        borderStyle: 'dashed',
                        borderColor: onHistoryPress ? toRgba(colors.purple[600], 0.35) : 'transparent',
                    }}
                >
                    <Text style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: onHistoryPress ? colors.purple[500] : colors.text.quaternary,
                        fontVariant: ['tabular-nums'],
                    }}>
                        {hasPrevious
                            ? `${Number.isInteger(previousWeight) ? previousWeight : previousWeight!.toFixed(1)}×${previousReps}`
                            : '—'}
                    </Text>
                </TouchableOpacity>

                {/* Weight cell — stacks "Meta: …" label above the input when prescribed. */}
                <View style={{ flex: 1, marginRight: 6 }}>
                    {weightMetaLabel ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: colors.purple[600],
                                textAlign: 'center',
                                marginBottom: 2,
                                letterSpacing: 0.2,
                            }}
                        >
                            {weightMetaLabel}
                        </Text>
                    ) : null}
                    <TextInput
                        style={[
                            {
                                height: 38,
                                backgroundColor: colors.surface.card2,
                                borderRadius: 10,
                                textAlign: 'center',
                                fontWeight: '600',
                                fontSize: 15,
                                color: colors.text.primary,
                                fontVariant: ['tabular-nums'],
                            },
                            isCompleted && { backgroundColor: toRgba(colors.purple[600], 0.08), color: colors.purple[600] },
                            readOnly && { opacity: 0.85 },
                        ]}
                        placeholder={weightPlaceholder}
                        placeholderTextColor={hasWeightTarget ? toRgba(colors.purple[600], 0.55) : (hasPrevious ? colors.text.quaternary : colors.text.quaternary)}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        value={weight}
                        onChangeText={onWeightChange}
                        editable={!isCompleted && !readOnly}
                    />
                </View>

                {/* Reps cell — stacks "Meta: …" label above the input. The
                 *  meta string can include RIR / Tempo (Fase 4.5f). Fase
                 *  4.5g: removido `numberOfLines` — preferimos quebrar em
                 *  N linhas a esconder informação prescrita. Linha quebra
                 *  naturalmente em telas estreitas (iPhone SE pode ir pra
                 *  3 linhas com "Cluster + RIR + Tempo"; aceitável). */}
                <View style={{ flex: 1, marginRight: 6 }}>
                    {metaLabel ? (
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: colors.purple[600],
                                textAlign: 'center',
                                marginBottom: 2,
                                letterSpacing: 0.2,
                            }}
                        >
                            {metaLabel}
                        </Text>
                    ) : null}
                    <TextInput
                        style={[
                            {
                                height: 38,
                                backgroundColor: colors.surface.card2,
                                borderRadius: 10,
                                textAlign: 'center',
                                fontWeight: '600',
                                fontSize: 15,
                                color: colors.text.primary,
                                fontVariant: ['tabular-nums'],
                            },
                            isCompleted && { backgroundColor: toRgba(colors.purple[600], 0.08), color: colors.purple[600] },
                            readOnly && { opacity: 0.85 },
                        ]}
                        placeholder={repsPlaceholder}
                        placeholderTextColor={hasTarget ? toRgba(colors.purple[600], 0.55) : (hasPrevious ? colors.text.quaternary : colors.text.quaternary)}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        value={reps}
                        onChangeText={onRepsChange}
                        editable={!isCompleted && !readOnly}
                    />
                </View>

                {/* Check Button — circular, gray → violet (hidden in readOnly) */}
                {readOnly ? (
                    <View style={{ width: 40, height: 40 }} />
                ) : (
                    <TouchableOpacity
                        onPress={handleToggle}
                        activeOpacity={0.7}
                        style={[
                            {
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                            },
                            isCompleted
                                ? { backgroundColor: colors.purple[600] }
                                : { backgroundColor: colors.surface.card2, borderWidth: 1, borderColor: colors.border.default },
                        ]}
                    >
                        {isCompleted ? (
                            <Check size={18} color="#fff" strokeWidth={3} />
                        ) : (
                            <View style={{
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                borderWidth: 2,
                                borderColor: colors.text.quaternary,
                            }} />
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
});
