import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import {
    ArrowRightLeft,
    PlayCircle,
    Check,
    TrendingUp,
    TrendingDown,
    ChevronsDown,
    Layers,
    Dumbbell,
    Pencil,
} from 'lucide-react-native';
import type { MethodKey } from '@kinevo/shared/types/prescription';
import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels';
import { SetRow } from './SetRow';
import { TrainerNote } from './TrainerNote';
import type { SetPrescription } from '../../lib/hydrateWorkoutSets';

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
    /** Per-set prescription (Fase 4). When present, overrides the aggregate
     * summary in the header and is used to render badges + reps targets. */
    setScheme?: SetPrescription[] | null;
    /** Method preset marker. `null`/`'standard'` hides the chip. */
    methodKey?: MethodKey | null;
    /** Read-only rendering for the builder preview. */
    readOnly?: boolean;
}

function buildSchemeSummary(scheme: SetPrescription[]): { reps: string; rest: number } {
    const repsValues = scheme.map((s) => s.reps_target.trim());
    const allEqual = repsValues.every((r) => r === repsValues[0]);
    const reps = allEqual ? (repsValues[0] || '0') : repsValues.join('-');
    // Conservative rest: minimum across the scheme — matches summarizeSetScheme
    const rest = scheme.reduce(
        (min, s) => Math.min(min, Math.max(0, s.rest_seconds ?? 0)),
        Number.POSITIVE_INFINITY,
    );
    return { reps, rest: Number.isFinite(rest) ? rest : 0 };
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
    setScheme,
    methodKey,
    readOnly = false,
}: ExerciseCardProps) {

    const handleOpenVideo = () => {
        if (videoUrl) {
            onVideoPress?.(videoUrl);
        } else {
            Alert.alert("Vídeo indisponível", "Este exercício não possui vídeo cadastrado.");
        }
    };

    const hasScheme = Array.isArray(setScheme) && setScheme.length > 0;
    const summary = hasScheme ? buildSchemeSummary(setScheme!) : null;
    const displaySets = hasScheme ? setScheme!.length : sets;
    const displayReps = hasScheme ? summary!.reps : reps;
    const displayRest = hasScheme ? summary!.rest : restSeconds;
    const methodChip = getMethodChipLabel(methodKey);
    const MethodIcon = (() => {
        switch (methodKey) {
            case 'pyramid_down': return TrendingDown;
            case 'pyramid_up':   return TrendingUp;
            case 'drop_set':     return ChevronsDown;
            case 'cluster':      return Layers;
            case 'top_backoff':  return TrendingUp;
            case '5x5':          return Dumbbell;
            case 'custom':       return Pencil;
            default:             return Dumbbell;
        }
    })();

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', flexShrink: 1 }}>
                            {exerciseName}
                        </Text>
                        {methodChip ? (
                            <View
                                accessibilityLabel={`Método: ${methodChip}`}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(124, 58, 237, 0.12)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(124, 58, 237, 0.25)',
                                }}
                            >
                                <MethodIcon size={11} color="#6d28d9" strokeWidth={2.4} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#6d28d9', letterSpacing: 0.2 }}>
                                    {methodChip}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>
                        {displaySets} séries • {displayReps} reps • {displayRest}s descanso
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
                    {!readOnly && (
                        <TouchableOpacity
                            onPress={onSwapPress}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(124, 58, 237, 0.1)' }}
                        >
                            <ArrowRightLeft size={18} color="#7c3aed" />
                        </TouchableOpacity>
                    )}
                    {!readOnly && (
                        <TouchableOpacity
                            onPress={handleOpenVideo}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(124, 58, 237, 0.1)' }}
                        >
                            <PlayCircle size={18} color="#7c3aed" />
                        </TouchableOpacity>
                    )}
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
                    const prescription = hasScheme ? setScheme![index] : null;
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
                            setType={prescription?.set_type ?? 'normal'}
                            repsTarget={prescription?.reps_target}
                            readOnly={readOnly}
                        />
                    );
                })}
            </View>
        </BlurView>
    );
}
