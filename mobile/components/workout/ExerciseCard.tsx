import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowRightLeft, PlayCircle, Check } from 'lucide-react-native';
import { SetRow } from './SetRow';
import { TrainerNote } from './TrainerNote';

export interface SetData {
    weight: string;
    reps: string;
    completed: boolean;
}

export interface PreviousSetData {
    set_number: number;
    weight: number;
    reps: number;
}

interface ExerciseCardProps {
    exerciseName: string;
    sets: number;
    reps: string;
    restSeconds: number;
    setsData: SetData[];
    onSetChange: (index: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSetComplete: (index: number) => void;
    videoUrl?: string;
    previousLoad?: string;
    previousSets?: PreviousSetData[];
    onVideoPress?: (url: string) => void;
    onSwapPress?: () => void;
    isSwapped?: boolean;
    notes?: string | null;
    supersetBadge?: string;
}

export function ExerciseCard({
    exerciseName,
    sets,
    reps,
    restSeconds,
    setsData,
    onSetChange,
    onToggleSetComplete,
    videoUrl,
    previousLoad,
    previousSets,
    onVideoPress,
    onSwapPress,
    isSwapped,
    notes,
    supersetBadge,
}: ExerciseCardProps) {

    const handleOpenVideo = () => {
        if (videoUrl) {
            onVideoPress?.(videoUrl);
        } else {
            Alert.alert("Vídeo indisponível", "Este exercício não possui vídeo cadastrado.");
        }
    };

    return (
        <BlurView
            intensity={60}
            tint="light"
            className="rounded-2xl"
            style={{
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.6)',
                padding: 12,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
            }}
        >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 }}>
                        {exerciseName}
                    </Text>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>
                        {sets} séries • {reps} reps • {restSeconds}s descanso
                    </Text>
                    {/* Fallback: show "Carga anterior" only when per-set data is unavailable */}
                    {!previousSets?.length && previousLoad && (
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>
                            Carga anterior: {previousLoad}
                        </Text>
                    )}
                    {isSwapped && (
                        <Text style={{ color: '#7c3aed', fontSize: 11, marginTop: 2 }}>
                            Exercício substituído nesta sessão
                        </Text>
                    )}
                    {supersetBadge && (
                        <Text style={{ color: '#7c3aed', fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                            {supersetBadge}
                        </Text>
                    )}
                    {notes ? <TrainerNote note={notes} /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                        onPress={onSwapPress}
                        style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(124, 58, 237, 0.1)' }}
                    >
                        <ArrowRightLeft size={18} color="#7c3aed" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleOpenVideo}
                        style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(124, 58, 237, 0.1)' }}
                    >
                        <PlayCircle size={18} color="#7c3aed" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Column Headers */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 2 }}>
                <View style={{ width: 26, marginRight: 6 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>#</Text>
                </View>
                <View style={{ width: 58, marginRight: 6 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>Anterior</Text>
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>Peso</Text>
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>Reps</Text>
                </View>
                <View style={{ width: 40, alignItems: 'center' }}>
                    <Check size={10} color="#94a3b8" />
                </View>
            </View>

            {/* Sets List */}
            <View>
                {setsData.map((set, index) => {
                    const prev = previousSets?.[index];
                    return (
                        <SetRow
                            key={index}
                            index={index}
                            weight={set.weight}
                            reps={set.reps}
                            isCompleted={set.completed}
                            onWeightChange={(val) => onSetChange(index, 'weight', val)}
                            onRepsChange={(val) => onSetChange(index, 'reps', val)}
                            onToggleComplete={() => onToggleSetComplete(index)}
                            previousWeight={prev?.weight}
                            previousReps={prev?.reps}
                        />
                    );
                })}
            </View>
        </BlurView>
    );
}
