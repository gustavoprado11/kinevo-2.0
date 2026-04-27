import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Eye } from 'lucide-react-native';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { useProgramBuilderStore } from '@/stores/program-builder-store';
import { hydrateSetPrescriptions } from '@/lib/hydrateWorkoutSets';
import type { WorkoutItem } from '@/stores/program-builder-store';

interface PreviewItem {
    id: string;
    isSuperset: boolean;
    children: WorkoutItem[];
}

/** Group items into top-level entries (exercises) and supersets with their
 *  children, mirroring how the workout player renders them. */
function groupItemsForPreview(items: WorkoutItem[]): PreviewItem[] {
    const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
    const supersetParents = new Map<string, WorkoutItem>();
    for (const item of sorted) {
        if (item.item_type === 'superset') supersetParents.set(item.id, item);
    }
    const grouped: PreviewItem[] = [];
    const pushedSupersets = new Set<string>();
    for (const item of sorted) {
        if (item.item_type === 'superset') {
            if (pushedSupersets.has(item.id)) continue;
            const children = sorted
                .filter((c) => c.parent_item_id === item.id)
                .sort((a, b) => a.order_index - b.order_index);
            grouped.push({ id: item.id, isSuperset: true, children });
            pushedSupersets.add(item.id);
            continue;
        }
        if (item.parent_item_id) {
            const parent = supersetParents.get(item.parent_item_id);
            if (parent) {
                if (!pushedSupersets.has(parent.id)) {
                    const children = sorted
                        .filter((c) => c.parent_item_id === parent.id)
                        .sort((a, b) => a.order_index - b.order_index);
                    grouped.push({ id: parent.id, isSuperset: true, children });
                    pushedSupersets.add(parent.id);
                }
                continue;
            }
        }
        grouped.push({ id: item.id, isSuperset: false, children: [item] });
    }
    return grouped;
}

export default function ProgramBuilderPreviewScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const draft = useProgramBuilderStore((s) => s.draft);
    const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(
        draft.workouts[0]?.id ?? null,
    );

    const activeWorkout = useMemo(
        () => draft.workouts.find((w) => w.id === activeWorkoutId) ?? draft.workouts[0] ?? null,
        [draft.workouts, activeWorkoutId],
    );

    const groupedItems = useMemo(
        () => (activeWorkout ? groupItemsForPreview(activeWorkout.items) : []),
        [activeWorkout],
    );

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: '#e2e8f0',
                        backgroundColor: '#ffffff',
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar para o builder"
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <ChevronLeft size={22} color="#7c3aed" />
                        <Text style={{ fontSize: 16, color: '#7c3aed', marginLeft: 2 }}>Voltar</Text>
                    </TouchableOpacity>
                    <Text
                        style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0f172a' }}
                        numberOfLines={1}
                    >
                        {draft.name?.trim() ? draft.name : 'Pré-visualização'}
                    </Text>
                    <View style={{ width: 70 }} />
                </View>

                {/* Banner */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    }}
                >
                    <Eye size={14} color="#6d28d9" />
                    <Text style={{ fontSize: 12, color: '#6d28d9', fontWeight: '600' }}>
                        Modo preview — assim que o aluno verá
                    </Text>
                </View>

                {/* Workout tabs (when there's more than one) */}
                {draft.workouts.length > 1 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            gap: 8,
                        }}
                        style={{ flexGrow: 0 }}
                    >
                        {draft.workouts.map((w) => {
                            const active = w.id === activeWorkout?.id;
                            return (
                                <TouchableOpacity
                                    key={w.id}
                                    onPress={() => setActiveWorkoutId(w.id)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 999,
                                        backgroundColor: active ? '#7c3aed' : '#ffffff',
                                        borderWidth: 1,
                                        borderColor: active ? '#7c3aed' : '#e2e8f0',
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: '600',
                                            color: active ? '#ffffff' : '#475569',
                                        }}
                                    >
                                        {w.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}

                <ScrollView
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 16,
                        paddingBottom: insets.bottom + 32,
                    }}
                >
                    {!activeWorkout || activeWorkout.items.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingTop: 80 }}>
                            <Text style={{ fontSize: 14, color: '#64748b' }}>
                                Adicione exercícios para visualizar o treino.
                            </Text>
                        </View>
                    ) : (
                        groupedItems.map((group) => {
                            if (group.isSuperset) {
                                return (
                                    <View key={group.id} style={{ marginBottom: 8 }}>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                fontWeight: '700',
                                                color: '#7c3aed',
                                                marginBottom: 6,
                                                textTransform: 'uppercase',
                                                letterSpacing: 1,
                                            }}
                                        >
                                            Superset
                                        </Text>
                                        {group.children.map((child, idx) => (
                                            <PreviewExerciseCard
                                                key={child.id}
                                                item={child}
                                                supersetBadge={`Exercício ${idx + 1} de ${group.children.length}`}
                                            />
                                        ))}
                                    </View>
                                );
                            }
                            return <PreviewExerciseCard key={group.id} item={group.children[0]} />;
                        })
                    )}
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

interface PreviewExerciseCardProps {
    item: WorkoutItem;
    supersetBadge?: string;
}

function PreviewExerciseCard({ item, supersetBadge }: PreviewExerciseCardProps) {
    const setPrescriptions = useMemo(
        () =>
            hydrateSetPrescriptions({
                assignedSets: item.set_scheme,
                aggregateSets: item.sets,
                aggregateReps: item.reps,
                aggregateRestSeconds: item.rest_seconds,
            }),
        [item.set_scheme, item.sets, item.reps, item.rest_seconds],
    );

    const setsData = useMemo(
        () => setPrescriptions.map(() => ({ weight: '', reps: '', completed: false })),
        [setPrescriptions],
    );

    return (
        <ExerciseCard
            exerciseName={item.exercise_name}
            sets={setPrescriptions.length || item.sets}
            reps={item.reps}
            restSeconds={item.rest_seconds}
            setsData={setsData}
            onSetChange={() => {}}
            onToggleSetComplete={() => {}}
            notes={item.notes}
            supersetBadge={supersetBadge}
            setScheme={item.set_scheme && item.set_scheme.length > 0 ? setPrescriptions : null}
            methodKey={item.method_key}
            readOnly
        />
    );
}
