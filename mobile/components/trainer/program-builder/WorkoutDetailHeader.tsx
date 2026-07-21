import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Pencil, Trash2, Dumbbell, Activity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DaySelector, computeOccupiedDays } from './DaySelector';
import { useV2Colors } from '@/hooks/useV2Colors';
import type { Workout } from '@/stores/program-builder-store';

interface WorkoutDetailHeaderProps {
    workout: Workout;
    allWorkouts: Workout[];
    onRename: (newName: string) => void;
    onUpdateFrequency: (days: string[]) => void;
    onDelete: () => void;
    onChangeWorkoutType?: (type: 'strength' | 'cardio') => void;
}

export function WorkoutDetailHeader({
    workout,
    allWorkouts,
    onRename,
    onUpdateFrequency,
    onDelete,
    onChangeWorkoutType,
}: WorkoutDetailHeaderProps) {
    const colors = useV2Colors();
    const occupiedDays = useMemo(
        () => computeOccupiedDays(allWorkouts, workout.id),
        [allWorkouts, workout.id],
    );

    const isCardio = workout.workout_type === 'cardio';
    const hasStrengthItems = workout.items.some(
        (it) => it.item_type === 'exercise' || it.item_type === 'superset',
    );

    const exerciseCount = workout.items.filter((it) => it.item_type === 'exercise').length;
    const totalSets = workout.items
        .filter((it) => it.item_type === 'exercise')
        .reduce((acc, it) => acc + (it.set_scheme?.length ?? it.sets ?? 0), 0);

    // Sessão aeróbia: subtítulo mostra blocos + minutos prescritos.
    const cardioBlocks = workout.items.filter((it) => it.item_type === 'cardio').length;
    const cardioMinutes = Math.round(workout.items.reduce((acc, it) => {
        if (it.item_type !== 'cardio') return acc;
        const cfg = (it.item_config ?? {}) as Record<string, any>;
        if (cfg.mode === 'interval' && cfg.intervals) {
            const { work_seconds = 0, rest_seconds = 0, rounds = 0 } = cfg.intervals;
            return acc + ((work_seconds + rest_seconds) * rounds) / 60;
        }
        return acc + (typeof cfg.duration_minutes === 'number' ? cfg.duration_minutes : 0);
    }, 0));

    const handleTypeSwitch = (type: 'strength' | 'cardio') => {
        if (!onChangeWorkoutType || type === (workout.workout_type ?? 'strength')) return;
        if (type === 'cardio' && hasStrengthItems) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                'Treino com exercícios de força',
                'Remova os exercícios de força para converter este treino em aeróbio.',
            );
            return;
        }
        Haptics.selectionAsync();
        onChangeWorkoutType(type);
    };

    const handleRename = () => {
        Haptics.selectionAsync();
        Alert.prompt(
            'Renomear treino',
            'Digite o novo nome:',
            (text) => {
                if (text && text.trim()) onRename(text.trim());
            },
            'plain-text',
            workout.name,
        );
    };

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Excluir treino',
            `Deseja excluir o "${workout.name}"? Esta ação não pode ser desfeita.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: onDelete },
            ],
        );
    };

    const canDelete = allWorkouts.length > 1;

    return (
        <View style={{
            backgroundColor: colors.surface.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border.default,
            marginHorizontal: 20,
            marginBottom: 8,
            padding: 14,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity
                    onPress={handleRename}
                    accessibilityRole="button"
                    accessibilityLabel="Renomear treino"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: '800',
                            color: colors.text.primary,
                            letterSpacing: -0.3,
                        }}
                        numberOfLines={1}
                    >
                        {workout.name}
                    </Text>
                    <Pencil size={14} color={colors.text.tertiary} />
                </TouchableOpacity>

                {canDelete && (
                    <TouchableOpacity
                        onPress={handleDelete}
                        accessibilityRole="button"
                        accessibilityLabel="Excluir treino"
                        hitSlop={8}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: 'rgba(239,68,68,0.08)',
                        }}
                    >
                        <Trash2 size={13} color={colors.semantic.danger.default} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.semantic.danger.default }}>
                            Excluir
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={{ fontSize: 11, color: colors.text.tertiary, fontWeight: '500', marginTop: 4 }}>
                {isCardio
                    ? `${cardioBlocks} ${cardioBlocks === 1 ? 'bloco' : 'blocos'}${cardioMinutes > 0 ? ` · ${cardioMinutes} min` : ''}`
                    : `${exerciseCount} ${exerciseCount === 1 ? 'exercício' : 'exercícios'} · ${totalSets} ${totalSets === 1 ? 'série' : 'séries'}`}
            </Text>

            {onChangeWorkoutType && (
                <View style={{
                    flexDirection: 'row',
                    gap: 4,
                    marginTop: 10,
                    padding: 3,
                    borderRadius: 10,
                    backgroundColor: colors.surface.card2,
                    alignSelf: 'flex-start',
                }}>
                    <TouchableOpacity
                        onPress={() => handleTypeSwitch('strength')}
                        accessibilityRole="button"
                        accessibilityLabel="Treino de força"
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: !isCardio ? colors.surface.card : 'transparent',
                        }}
                    >
                        <Dumbbell size={12} color={!isCardio ? colors.text.primary : colors.text.quaternary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: !isCardio ? colors.text.primary : colors.text.quaternary }}>
                            Força
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleTypeSwitch('cardio')}
                        accessibilityRole="button"
                        accessibilityLabel="Treino aeróbio"
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: isCardio ? colors.surface.card : 'transparent',
                            opacity: !isCardio && hasStrengthItems ? 0.5 : 1,
                        }}
                    >
                        <Activity size={12} color={isCardio ? '#06b6d4' : colors.text.quaternary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isCardio ? '#0891b2' : colors.text.quaternary }}>
                            Aeróbio
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ marginTop: 10 }}>
                <DaySelector
                    frequency={workout.frequency}
                    occupiedDays={occupiedDays}
                    onUpdateFrequency={onUpdateFrequency}
                />
            </View>
        </View>
    );
}
