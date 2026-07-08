/**
 * WorkoutFocusExercise — conteúdo de UMA página do modo Foco (um exercício).
 * Cabeçalho de foco (eyebrow "EXERCÍCIO k DE n" + nome + meta + Trocar/Vídeo) +
 * card de instruções (notas do treinador) + grade de séries (ExerciseBody).
 * Reusa ExerciseBody (Fase 0). O vídeo abre o ExerciseVideoModal (o player
 * crescente ancorado é a Fase 4). Fase 3.
 */
import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowRightLeft, Play, Info } from 'lucide-react-native';
import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels';
import { ExerciseBody } from './ExerciseBody';
import type { ExerciseData } from '../../hooks/useWorkoutSession';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

interface WorkoutFocusExerciseProps {
    exercise: ExerciseData;
    /** Posição 1-based entre os itens de trabalho. */
    position: number;
    total: number;
    globalIndex: number;
    onSetChangeGlobal: (globalIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSetCompleteGlobal: (globalIndex: number, setIndex: number) => void;
    onSwapPressGlobal: (globalIndex: number) => void;
    onVideoPress: (url: string) => void;
}

function ActionPill({ icon: Icon, label, onPress }: { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; label: string; onPress: () => void }) {
    const colors = useV2Colors();
    return (
        <Pressable
            onPress={() => { Haptics.selectionAsync(); onPress(); }}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: toRgba(colors.purple[600], 0.1), paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 }}
        >
            <Icon size={14} color={colors.purple[700]} strokeWidth={2.2} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.purple[700] }}>{label}</Text>
        </Pressable>
    );
}

export const WorkoutFocusExercise = React.memo(function WorkoutFocusExercise({
    exercise, position, total, globalIndex,
    onSetChangeGlobal, onToggleSetCompleteGlobal, onSwapPressGlobal, onVideoPress,
}: WorkoutFocusExerciseProps) {
    const colors = useV2Colors();
    const methodChip = getMethodChipLabel(exercise.methodKey);
    const rest = exercise.rest_seconds > 0 ? ` · ${exercise.rest_seconds}s descanso` : '';
    const meta = `${exercise.setsData.length} séries · ${exercise.reps} reps${rest}`;

    const handleVideo = () => {
        if (exercise.video_url) onVideoPress(exercise.video_url);
        else Alert.alert('Vídeo indisponível', 'Este exercício não possui vídeo cadastrado.');
    };

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.purple[700], letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
                        Exercício {position} de {total}
                    </Text>
                    <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.2 }}>
                        {exercise.name}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: colors.text.tertiary, marginTop: 3 }}>{meta}</Text>
                    {methodChip ? (
                        <View style={{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: toRgba(colors.purple[600], 0.12) }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[700] }}>{methodChip}</Text>
                        </View>
                    ) : null}
                </View>
                <View style={{ gap: 6 }}>
                    <ActionPill icon={ArrowRightLeft} label="Trocar" onPress={() => onSwapPressGlobal(globalIndex)} />
                    <ActionPill icon={Play} label="Vídeo" onPress={handleVideo} />
                </View>
            </View>

            {exercise.notes ? (
                <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 14, padding: 12, marginTop: 12 }}>
                    <Info size={16} color={colors.purple[600]} strokeWidth={2} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.text.secondary }}>{exercise.notes}</Text>
                </View>
            ) : null}

            {!exercise.previousSets?.length && exercise.previousLoad ? (
                <Text style={{ color: colors.text.tertiary, fontSize: 12, fontStyle: 'italic', marginTop: 10 }}>
                    Carga anterior: {exercise.previousLoad}
                </Text>
            ) : null}

            <View style={{ backgroundColor: colors.surface.card, borderRadius: 18, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.border.subtle }}>
                <ExerciseBody
                    setsData={exercise.setsData}
                    setScheme={exercise.setScheme}
                    rounds={exercise.rounds}
                    restSeconds={exercise.rest_seconds}
                    previousSets={exercise.previousSets}
                    onSetChange={(setIndex, field, value) => onSetChangeGlobal(globalIndex, setIndex, field, value)}
                    onToggleSetComplete={(setIndex) => onToggleSetCompleteGlobal(globalIndex, setIndex)}
                />
            </View>
        </View>
    );
});
