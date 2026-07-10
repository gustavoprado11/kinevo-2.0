/**
 * WorkoutFocusExercise — conteúdo de UMA página do modo Foco (um exercício),
 * conforme o design "Treino Um Por Vez": eyebrow "EXERCÍCIO k DE n" + Trocar (mesma
 * linha) → nome → meta → card de demonstração compacto (toque abre o modal) → nota
 * do treinador → grade de séries (ExerciseBody, Fase 0). O vídeo é o FocusVideoCard
 * (substitui o player crescente da Fase 4). Fase 3.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowRightLeft, Info } from 'lucide-react-native';
import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels';
import { ExerciseBody } from './ExerciseBody';
import { FocusVideoCard } from './FocusVideoCard';
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

export const WorkoutFocusExercise = React.memo(function WorkoutFocusExercise({
    exercise, position, total, globalIndex,
    onSetChangeGlobal, onToggleSetCompleteGlobal, onSwapPressGlobal, onVideoPress,
}: WorkoutFocusExerciseProps) {
    const colors = useV2Colors();
    const methodChip = getMethodChipLabel(exercise.methodKey);
    const rest = exercise.rest_seconds > 0 ? ` · ${exercise.rest_seconds}s descanso` : '';
    const meta = `${exercise.setsData.length} séries · ${exercise.reps} reps${rest}`;

    return (
        <View>
            {/* Eyebrow + Trocar (mesma linha) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[700], letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    Exercício {position} de {total}
                </Text>
                <Pressable
                    onPress={() => { Haptics.selectionAsync(); onSwapPressGlobal(globalIndex); }}
                    accessibilityRole="button"
                    accessibilityLabel="Trocar exercício"
                    hitSlop={6}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: toRgba(colors.purple[600], 0.1), paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}
                >
                    <ArrowRightLeft size={13} color={colors.purple[700]} strokeWidth={2.2} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.purple[700] }}>Trocar</Text>
                </Pressable>
            </View>

            {/* Nome + meta */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3, lineHeight: 27, marginTop: 8 }}>
                {exercise.name}
            </Text>
            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4 }}>{meta}</Text>
            {methodChip ? (
                <View style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: toRgba(colors.purple[600], 0.12) }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[700] }}>{methodChip}</Text>
                </View>
            ) : null}

            {/* Card de demonstração (só quando há vídeo) */}
            {exercise.video_url ? (
                <FocusVideoCard videoUrl={exercise.video_url} onPress={onVideoPress} />
            ) : null}

            {/* Nota do treinador (destaque roxo) */}
            {exercise.notes ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: toRgba(colors.purple[600], 0.09), borderRadius: 16, padding: 14, marginTop: 14 }}>
                    <Info size={16} color={colors.purple[600]} strokeWidth={2} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 13, lineHeight: 19.5, color: colors.purple[700] }}>{exercise.notes}</Text>
                </View>
            ) : null}

            {!exercise.previousSets?.length && exercise.previousLoad ? (
                <Text style={{ color: colors.text.tertiary, fontSize: 12, fontStyle: 'italic', marginTop: 10 }}>
                    Carga anterior: {exercise.previousLoad}
                </Text>
            ) : null}

            {/* Grade de séries */}
            <View style={{ backgroundColor: colors.surface.card, borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: colors.border.subtle }}>
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
