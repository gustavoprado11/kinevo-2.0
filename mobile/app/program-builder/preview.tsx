import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Eye } from 'lucide-react-native';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { useProgramBuilderStore } from '@/stores/program-builder-store';
import { useV2Colors, useIsDark } from '@/hooks/useV2Colors';
import { hydrateSetPrescriptions } from '@/lib/hydrateWorkoutSets';
import { toRgba } from '@/lib/brandColor';
import { expandSchemeByRounds } from '@kinevo/shared/lib/prescription/set-scheme';
import { isCompoundMethod } from '@kinevo/shared/lib/prescription/set-scheme-presets';
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
    const colors = useV2Colors();
    const isDark = useIsDark();
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
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border.default,
                        backgroundColor: colors.surface.card,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar para o builder"
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <ChevronLeft size={22} color={colors.purple[600]} />
                        <Text style={{ fontSize: 16, color: colors.purple[600], marginLeft: 2 }}>Voltar</Text>
                    </TouchableOpacity>
                    <Text
                        style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text.primary }}
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
                        backgroundColor: toRgba(colors.purple[600], 0.08),
                    }}
                >
                    <Eye size={14} color={colors.purple[700]} />
                    <Text style={{ fontSize: 12, color: colors.purple[700], fontWeight: '600' }}>
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
                            alignItems: 'center',
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
                                    /* minHeight + justifyContent center
                                     * garantem que o chip tenha altura
                                     * suficiente pra acomodar o texto +
                                     * line-height padrão do iOS sem cortar
                                     * a metade superior das letras. */
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        minHeight: 34,
                                        borderRadius: 999,
                                        backgroundColor: active ? colors.purple[600] : colors.surface.card2,
                                        borderWidth: 1,
                                        borderColor: active ? colors.purple[600] : colors.border.default,
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            lineHeight: 17,
                                            fontWeight: '600',
                                            color: active ? '#ffffff' : colors.text.secondary,
                                            includeFontPadding: false,
                                            textAlignVertical: 'center',
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
                            <Text style={{ fontSize: 14, color: colors.text.secondary }}>
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
                                                color: colors.purple[600],
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
    // Preview reads the in-memory draft (per-round shape) and expands locally
    // so the trainer sees exactly what the student will see post-save. The
    // builder never persists materialized rows in the draft; expansion only
    // happens at save time and at preview time.
    const effectiveRounds = isCompoundMethod(item.method_key) ? Math.max(1, item.rounds ?? 1) : 1;
    const expandedScheme = useMemo(() => {
        if (!item.set_scheme || item.set_scheme.length === 0) return null;
        return effectiveRounds > 1
            ? expandSchemeByRounds(item.set_scheme, effectiveRounds)
            : item.set_scheme;
    }, [item.set_scheme, effectiveRounds]);

    const setPrescriptions = useMemo(
        () =>
            hydrateSetPrescriptions({
                assignedSets: expandedScheme,
                aggregateSets: item.sets,
                aggregateReps: item.reps,
                aggregateRestSeconds: item.rest_seconds,
            }),
        [expandedScheme, item.sets, item.reps, item.rest_seconds],
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
            setScheme={expandedScheme && expandedScheme.length > 0 ? setPrescriptions : null}
            methodKey={item.method_key}
            rounds={effectiveRounds}
            readOnly
        />
    );
}
