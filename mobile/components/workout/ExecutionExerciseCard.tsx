/**
 * ExecutionExerciseCard — card de um exercício no modo "Lista completa" (Fase 2).
 *
 * Recolhido: só a linha-resumo (ExerciseSummaryRow). Expandido: linha-resumo +
 * ações (Trocar/Vídeo) + a grade de séries (ExerciseBody, reusado da Fase 0).
 * Só o exercício ATUAL fica expandido por padrão; tocar num recolhido o expande
 * (D3). NÃO substitui o ExerciseCard das outras telas — é específico do player.
 *
 * Callbacks Global + globalIndex (contrato estável do player) são ligados aqui
 * antes de descer ao ExerciseBody.
 */
import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowRightLeft, Play } from 'lucide-react-native';
import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels';
import { ExerciseBody } from './ExerciseBody';
import { ExerciseSummaryRow, type ExerciseStatus } from './ExerciseSummaryRow';
import { TrainerNote } from './TrainerNote';
import type { ExerciseData } from '../../hooks/useWorkoutSession';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

interface ExecutionExerciseCardProps {
    exercise: ExerciseData;
    number: number;
    status: ExerciseStatus;
    expanded: boolean;
    onToggleExpand: () => void;
    globalIndex: number;
    onSetChangeGlobal: (globalIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSetCompleteGlobal: (globalIndex: number, setIndex: number) => void;
    onSwapPressGlobal: (globalIndex: number) => void;
    onVideoPress: (url: string) => void;
}

function buildMeta(exercise: ExerciseData, status: ExerciseStatus): string {
    const total = exercise.setsData.length;
    const seriesLabel = `${total} série${total === 1 ? '' : 's'}`;
    if (status === 'done') return `${seriesLabel} · concluído`;
    const rest = exercise.rest_seconds > 0 ? ` · ${exercise.rest_seconds}s` : '';
    return `${seriesLabel} · ${exercise.reps} reps${rest}`;
}

function ActionPill({ icon: Icon, label, onPress }: { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; label: string; onPress: () => void }) {
    const colors = useV2Colors();
    return (
        <Pressable
            onPress={() => { Haptics.selectionAsync(); onPress(); }}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: toRgba(colors.purple[600], 0.1), paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11 }}
        >
            <Icon size={13} color={colors.purple[700]} strokeWidth={2.2} />
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.purple[700] }}>{label}</Text>
        </Pressable>
    );
}

export const ExecutionExerciseCard = React.memo(function ExecutionExerciseCard({
    exercise,
    number,
    status,
    expanded,
    onToggleExpand,
    globalIndex,
    onSetChangeGlobal,
    onToggleSetCompleteGlobal,
    onSwapPressGlobal,
    onVideoPress,
}: ExecutionExerciseCardProps) {
    const colors = useV2Colors();
    const isCurrent = status === 'current';
    const methodChip = getMethodChipLabel(exercise.methodKey);

    const handleVideo = () => {
        if (exercise.video_url) onVideoPress(exercise.video_url);
        else Alert.alert('Vídeo indisponível', 'Este exercício não possui vídeo cadastrado.');
    };

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 20,
                borderWidth: isCurrent ? 1.5 : 1,
                borderColor: isCurrent ? colors.purple[600] : colors.border.subtle,
                padding: 14,
                marginBottom: 14,
                ...(isCurrent
                    ? { shadowColor: colors.purple[600], shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 4 }
                    : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 }),
            }}
        >
            <ExerciseSummaryRow
                number={number}
                name={exercise.name}
                meta={buildMeta(exercise, status)}
                status={status}
                // O atual fica sempre expandido (sem toggle); os demais alternam.
                onPress={isCurrent ? undefined : onToggleExpand}
                expanded={expanded}
            />

            {expanded ? (
                <>
                    <View style={{ height: 1, backgroundColor: colors.border.subtle, marginHorizontal: -14, marginTop: 12, marginBottom: 10 }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                            {methodChip ? (
                                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: toRgba(colors.purple[600], 0.12) }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[700] }}>{methodChip}</Text>
                                </View>
                            ) : null}
                            {exercise.swap_source !== 'none' ? (
                                <Text style={{ fontSize: 11, color: colors.purple[600] }}>substituído</Text>
                            ) : null}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <ActionPill icon={ArrowRightLeft} label="Trocar" onPress={() => onSwapPressGlobal(globalIndex)} />
                            <ActionPill icon={Play} label="Vídeo" onPress={handleVideo} />
                        </View>
                    </View>

                    {exercise.notes ? <TrainerNote note={exercise.notes} /> : null}

                    {!exercise.previousSets?.length && exercise.previousLoad ? (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, fontStyle: 'italic', marginBottom: 6 }}>
                            Carga anterior: {exercise.previousLoad}
                        </Text>
                    ) : null}

                    <ExerciseBody
                        setsData={exercise.setsData}
                        setScheme={exercise.setScheme}
                        rounds={exercise.rounds}
                        restSeconds={exercise.rest_seconds}
                        previousSets={exercise.previousSets}
                        onSetChange={(setIndex, field, value) => onSetChangeGlobal(globalIndex, setIndex, field, value)}
                        onToggleSetComplete={(setIndex) => onToggleSetCompleteGlobal(globalIndex, setIndex)}
                    />
                </>
            ) : null}
        </View>
    );
});
