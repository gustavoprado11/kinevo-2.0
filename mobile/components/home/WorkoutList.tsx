import React from "react";
import { View, Text } from "react-native";
import { Dumbbell, ChevronRight, Check, Minus } from "lucide-react-native";
import { PressableScale } from "../shared/PressableScale";
import type { WeeklyProgress } from "@kinevo/shared/utils/schedule-projection";

interface WorkoutListProps {
    workouts: any[];
    onWorkoutPress: (id: string) => void;
    weeklyProgress?: WeeklyProgress | null;
    todayCompletedIds?: Set<string>;
}

export function WorkoutList({ workouts, onWorkoutPress, weeklyProgress, todayCompletedIds }: WorkoutListProps) {
    if (workouts.length === 0) return null;

    return (
        <View>
            <Text className="text-xl font-bold text-slate-900 mb-4 tracking-wide">
                Seus Treinos
            </Text>
            {workouts.map((workout, index) => {
                const counts = weeklyProgress?.workoutCounts.get(workout.id);
                const expected = counts?.expected || 0;
                const completed = counts?.completed || 0;
                const isFullyDone = expected > 0 && completed >= expected;
                const isPartial = expected > 0 && completed > 0 && completed < expected;
                const isDoneToday = todayCompletedIds?.has(workout.id) || false;

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
                                backgroundColor: '#ffffff',
                                borderWidth: 1,
                                borderColor: isFullyDone
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(0, 0, 0, 0.04)',
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
                                        ? '#dcfce7'
                                        : '#f5f3ff',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 16,
                                }}
                            >
                                {isFullyDone ? (
                                    <Check size={22} color="#16a34a" strokeWidth={2} />
                                ) : (
                                    <Dumbbell size={22} color="#7c3aed" strokeWidth={1.5} />
                                )}
                            </View>

                            {/* Content */}
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: '600',
                                        color: isFullyDone ? '#64748b' : '#0f172a',
                                        marginBottom: 3,
                                    }}
                                >
                                    {workout.name}
                                </Text>

                                {workout.notes && (
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: '#64748b',
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
                                            color: '#94a3b8',
                                            fontWeight: '400',
                                        }}
                                    >
                                        {workout.items?.length || 0} exercícios
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
                                                color: isFullyDone ? '#16a34a' : isPartial ? '#f59e0b' : '#94a3b8',
                                            }}>
                                                {completed}/{expected}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>
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
                            <ChevronRight size={18} color={isFullyDone ? '#a7f3d0' : '#cbd5e1'} strokeWidth={1.5} />
                        </View>
                    </PressableScale>
                );
            })}
        </View>
    );
}
