import React from 'react';
import { View, Text } from 'react-native';
import { Repeat, Clock } from 'lucide-react-native';
import { ExerciseCard } from './ExerciseCard';
import type { ExerciseData } from '../../hooks/useWorkoutSession';

interface SupersetGroupProps {
    exercises: ExerciseData[];
    supersetRestSeconds: number;
    onSetChange: (globalExerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSetComplete: (globalExerciseIndex: number, setIndex: number) => void;
    onVideoPress?: (url: string) => void;
    onSwapPress?: (globalExerciseIndex: number) => void;
    globalIndexOffset: number;
}

function computeRoundInfo(exercises: ExerciseData[]) {
    const totalRounds = Math.max(...exercises.map((e) => e.setsData.length), 0);
    let currentRound = totalRounds;
    for (let round = 0; round < totalRounds; round++) {
        const roundIncomplete = exercises.some(
            (e) => round < e.setsData.length && !e.setsData[round].completed
        );
        if (roundIncomplete) {
            currentRound = round;
            break;
        }
    }
    return { currentRound, totalRounds };
}

export function SupersetGroup({
    exercises,
    supersetRestSeconds,
    onSetChange,
    onToggleSetComplete,
    onVideoPress,
    onSwapPress,
    globalIndexOffset,
}: SupersetGroupProps) {
    const { currentRound, totalRounds } = computeRoundInfo(exercises);
    const allDone = currentRound >= totalRounds;

    return (
        <View
            style={{
                borderWidth: 1.5,
                borderColor: allDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(124, 58, 237, 0.25)',
                backgroundColor: allDone ? 'rgba(16, 185, 129, 0.03)' : 'rgba(124, 58, 237, 0.03)',
                borderRadius: 20,
                padding: 12,
                marginBottom: 12,
            }}
        >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingRight: 4 }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    borderRadius: 8,
                }}>
                    <Repeat size={12} color="#7c3aed" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Superset
                    </Text>
                </View>
                <View style={{
                    backgroundColor: allDone ? 'rgba(16, 185, 129, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: allDone ? '#10b981' : '#7c3aed' }}>
                        {allDone ? 'Concluído' : `Rodada ${currentRound + 1} de ${totalRounds}`}
                    </Text>
                </View>
            </View>

            {/* Exercise cards with connectors */}
            {exercises.map((exercise, localIdx) => {
                const globalIdx = globalIndexOffset + localIdx;

                return (
                    <React.Fragment key={exercise.id}>
                        <ExerciseCard
                            exerciseName={exercise.name}
                            sets={exercise.sets}
                            reps={exercise.reps}
                            restSeconds={exercise.rest_seconds}
                            videoUrl={exercise.video_url}
                            previousLoad={exercise.previousLoad}
                            previousSets={exercise.previousSets}
                            setsData={exercise.setsData}
                            onSetChange={(setIndex, field, value) => onSetChange(globalIdx, setIndex, field, value)}
                            onToggleSetComplete={(setIndex) => onToggleSetComplete(globalIdx, setIndex)}
                            onVideoPress={onVideoPress}
                            onSwapPress={() => onSwapPress?.(globalIdx)}
                            isSwapped={exercise.swap_source !== 'none'}
                            notes={exercise.notes}
                            supersetBadge={`Exercício ${localIdx + 1} de ${exercises.length}`}
                        />
                        {/* "sem descanso" connector between exercises */}
                        {localIdx < exercises.length - 1 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 2, marginBottom: 8 }}>
                                <View style={{ height: 1, flex: 1, backgroundColor: 'rgba(124, 58, 237, 0.15)' }} />
                                <Text style={{ color: '#8b5cf6', fontSize: 10, marginHorizontal: 8, fontWeight: '500' }}>
                                    sem descanso
                                </Text>
                                <View style={{ height: 1, flex: 1, backgroundColor: 'rgba(124, 58, 237, 0.15)' }} />
                            </View>
                        )}
                    </React.Fragment>
                );
            })}

            {/* Rest info footer */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 4,
                paddingVertical: 6,
                paddingHorizontal: 12,
                backgroundColor: 'rgba(124, 58, 237, 0.06)',
                borderRadius: 10,
            }}>
                <Clock size={12} color="#8b5cf6" />
                <Text style={{ color: '#7c3aed', fontSize: 11, fontWeight: '500' }}>
                    Descanso entre rodadas: {supersetRestSeconds}s
                </Text>
            </View>
        </View>
    );
}
