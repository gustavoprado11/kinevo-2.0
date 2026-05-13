import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
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
}

export function WorkoutDetailHeader({
    workout,
    allWorkouts,
    onRename,
    onUpdateFrequency,
    onDelete,
}: WorkoutDetailHeaderProps) {
    const colors = useV2Colors();
    const occupiedDays = useMemo(
        () => computeOccupiedDays(allWorkouts, workout.id),
        [allWorkouts, workout.id],
    );

    const exerciseCount = workout.items.filter((it) => it.item_type === 'exercise').length;
    const totalSets = workout.items
        .filter((it) => it.item_type === 'exercise')
        .reduce((acc, it) => acc + (it.set_scheme?.length ?? it.sets ?? 0), 0);

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
                {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'} · {totalSets} {totalSets === 1 ? 'série' : 'séries'}
            </Text>

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
