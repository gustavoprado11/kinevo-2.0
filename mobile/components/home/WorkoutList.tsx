import React from "react";
import { View, Text } from "react-native";
import { Activity, Dumbbell, ChevronRight, Check, Minus } from "lucide-react-native";
import { PressableScale } from "../shared/PressableScale";
import type { WeeklyProgress } from "@kinevo/shared/utils/schedule-projection";
import { useV2Colors } from "../../hooks/useV2Colors";
import { useBrand } from "../../stores/brandStore";
import { toRgba } from "../../lib/brandColor";

interface WorkoutListProps {
    workouts: any[];
    onWorkoutPress: (id: string) => void;
    weeklyProgress?: WeeklyProgress | null;
    todayCompletedIds?: Set<string>;
}

export function WorkoutList({ workouts, onWorkoutPress, weeklyProgress, todayCompletedIds }: WorkoutListProps) {
    const colors = useV2Colors();
    const brand = useBrand();
    if (workouts.length === 0) return null;

    return (
        <View>
            <Text
                style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: colors.text.primary,
                    marginBottom: 16,
                    letterSpacing: 0.4,
                }}
            >
                Seus Treinos
            </Text>
            {workouts.map((workout, index) => {
                const counts = weeklyProgress?.workoutCounts.get(workout.id);
                const expected = counts?.expected || 0;
                const completed = counts?.completed || 0;
                const isFullyDone = expected > 0 && completed >= expected;
                const isPartial = expected > 0 && completed > 0 && completed < expected;
                const isDoneToday = todayCompletedIds?.has(workout.id) || false;
                const isCardio = workout.workout_type === 'cardio';

                return (
                    <PressableScale
                        key={workout.id}
                        onPress={() => onWorkoutPress(workout.id)}
                        style={{
                            marginBottom: 12,
                            borderRadius: 20,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: colors.surface.card,
                                borderWidth: 1,
                                borderColor: isFullyDone
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : colors.border.default,
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 18,
                                paddingHorizontal: 20,
                                borderRadius: 20,
                            }}
                        >
                            {/* Icon Badge with status */}
                            <View
                                style={{
                                    height: 48,
                                    width: 48,
                                    borderRadius: 14,
                                    backgroundColor: isFullyDone
                                        ? 'rgba(16,185,129,0.14)'
                                        : isCardio
                                            ? 'rgba(6,182,212,0.12)'
                                            : toRgba(brand.color, 0.12),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 16,
                                }}
                            >
                                {isFullyDone ? (
                                    <Check size={22} color="#16a34a" strokeWidth={2} />
                                ) : isCardio ? (
                                    <Activity size={22} color="#06b6d4" strokeWidth={1.5} />
                                ) : (
                                    <Dumbbell size={22} color={brand.color} strokeWidth={1.5} />
                                )}
                            </View>

                            {/* Content */}
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: '600',
                                        color: isFullyDone ? colors.text.tertiary : colors.text.primary,
                                        marginBottom: 3,
                                    }}
                                >
                                    {workout.name}
                                </Text>

                                {workout.notes && (
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: colors.text.tertiary,
                                            fontWeight: '400',
                                            marginBottom: 2,
                                        }}
                                        numberOfLines={1}
                                    >
                                        {workout.notes}
                                    </Text>
                                )}

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: colors.text.quaternary,
                                            fontWeight: '400',
                                        }}
                                    >
                                        {isCardio ? 'Treino aeróbio' : `${workout.items?.length || 0} exercícios`}
                                    </Text>

                                    {expected > 0 && (
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 3,
                                        }}>
                                            <Text style={{
                                                fontSize: 11,
                                                fontWeight: '600',
                                                color: isFullyDone ? '#16a34a' : isPartial ? '#f59e0b' : colors.text.quaternary,
                                            }}>
                                                {completed}/{expected}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: colors.text.quaternary }}>
                                                sem.
                                            </Text>
                                        </View>
                                    )}

                                    {isDoneToday && (() => {
                                        const todayDow = new Date().getDay();
                                        const isScheduledDay = Array.isArray(workout.scheduled_days) && workout.scheduled_days.some((d: any) => Number(d) === todayDow);
                                        const label = isScheduledDay ? 'Feito hoje' : 'Compensado';
                                        const color = isScheduledDay ? '#16a34a' : '#f59e0b';
                                        const bg = isScheduledDay ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
                                        return (
                                            <View style={{
                                                backgroundColor: bg,
                                                paddingHorizontal: 6,
                                                paddingVertical: 2,
                                                borderRadius: 6,
                                            }}>
                                                <Text style={{ fontSize: 9, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    {label}
                                                </Text>
                                            </View>
                                        );
                                    })()}
                                </View>
                            </View>

                            {/* Chevron */}
                            <ChevronRight size={18} color={isFullyDone ? '#A7F3D0' : colors.text.quaternary} strokeWidth={1.5} />
                        </View>
                    </PressableScale>
                );
            })}
        </View>
    );
}
