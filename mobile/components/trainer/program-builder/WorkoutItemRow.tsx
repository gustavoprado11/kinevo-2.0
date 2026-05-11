import React, { useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Alert } from "react-native";
import { GripVertical, Trash2, Sliders, Edit3, Copy } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useResponsive } from "@/hooks/useResponsive";
import { SetRepsInput } from "./SetRepsInput";
import { NoteItemRow } from "./NoteItemRow";
import { WarmupItemRow } from "./WarmupItemRow";
import { CardioItemRow } from "./CardioItemRow";
import type { WorkoutItem } from "@/stores/program-builder-store";
import type { MethodKey } from "@kinevo/shared/types/prescription";
import { SYSTEM_PRESETS } from "@kinevo/shared/lib/prescription/set-scheme-presets";

interface WorkoutItemRowProps {
    item: WorkoutItem;
    index: number;
    workoutId: string;
    onUpdate: (updates: Partial<Pick<WorkoutItem, 'sets' | 'reps' | 'rest_seconds' | 'notes'>>) => void;
    onDelete: () => void;
    onDuplicate?: () => void;
    onEditSets?: () => void;
    /** Toggle: chamado quando o trainer está em modo avançado e clica
     *  novamente em "Editar séries". Limpa set_scheme/method_key/rounds
     *  e re-popula os agregados via summarize. Quando ausente, o botão
     *  só entra (sem toggle de saída). */
    onExitAdvanced?: () => void;
    /** Trigger pra abrir o EditNoteSheet quando item.item_type === 'note'. */
    onEditNote?: () => void;
    /** Trigger pra abrir o EditWarmupSheet quando item.item_type === 'warmup'. */
    onEditWarmup?: () => void;
    /** Trigger pra abrir o EditCardioSheet quando item.item_type === 'cardio'. */
    onEditCardio?: () => void;
    drag?: () => void;
    isActive?: boolean;
}

const methodChipLabel = (key: MethodKey | null): string | null => {
    if (!key || key === "standard") return null;
    if (key === "custom") return "Customizado";
    return SYSTEM_PRESETS[key]?.name ?? "Customizado";
};

// Mapping grupo muscular → cor da strip lateral.
// Termos PT/EN porque exercise_muscle_groups vem do catálogo, que usa labels
// em português ("Peito", "Costas") mas pode receber legacy/imports em EN.
function pickGroupColor(groups: string[], colors: ReturnType<typeof useV2Colors>): string {
    const lower = groups.map(g => g.toLowerCase()).join(' ');
    if (/(peito|chest|peitor)/.test(lower)) return colors.semantic.danger.default;
    if (/(costas|back|dors|trap)/.test(lower)) return colors.semantic.info.default;
    if (/(perna|legs|quadr|posterior|gluteo|glúteo|panturr|calf|hamstring|quad)/.test(lower)) return colors.semantic.success.default;
    if (/(ombro|shoulder|delt)/.test(lower)) return colors.semantic.warning.default;
    if (/(braç|braco|arm|biceps|bíceps|triceps|tríceps|forearm|antebra)/.test(lower)) return colors.purple[500];
    if (/(core|abdom|abs|oblíquo|obliquo|lombar)/.test(lower)) return '#EAB308';
    return colors.text.tertiary;
}

interface SetChip {
    label: string;
    count: number;
}

// Computa os chips de séries: se todas iguais "Nx reps", retorna 1 chip
// agregado; senão, retorna 1 chip por série (ou por fase quando advanced).
function computeSetChips(item: WorkoutItem): SetChip[] {
    if (item.set_scheme && item.set_scheme.length > 0) {
        const scheme = item.set_scheme;
        const allSameReps = scheme.every(s => s.reps === scheme[0].reps);
        if (allSameReps) {
            return [{ label: `${scheme.length}× ${scheme[0].reps}`, count: 1 }];
        }
        return scheme.map(s => ({ label: s.reps, count: 1 }));
    }
    return [{ label: `${item.sets}× ${item.reps}`, count: 1 }];
}

// Estimativa: cada série ≈ 45s execução + descanso (fallback 90s).
// Para advanced, soma rest_seconds individuais de cada fase × rounds.
function estimateMinutes(item: WorkoutItem): number {
    const EXEC_SECONDS_PER_SET = 45;
    if (item.set_scheme && item.set_scheme.length > 0) {
        const rounds = Math.max(1, item.rounds ?? 1);
        const perRound = item.set_scheme.reduce((acc, s) => acc + EXEC_SECONDS_PER_SET + (s.rest_seconds ?? 90), 0);
        return Math.max(1, Math.round((perRound * rounds) / 60));
    }
    const sets = item.sets ?? 0;
    const rest = item.rest_seconds ?? 90;
    const total = sets * (EXEC_SECONDS_PER_SET + rest);
    return Math.max(1, Math.round(total / 60));
}

// Total de reps (somatório). Para strings tipo "8-12", usa o limite superior;
// "AMRAP" e similares contribuem com 0 (não estimável).
function estimateTotalReps(item: WorkoutItem): number {
    const parseReps = (s: string): number => {
        const range = s.match(/(\d+)\s*-\s*(\d+)/);
        if (range) return parseInt(range[2], 10);
        const single = s.match(/\d+/);
        return single ? parseInt(single[0], 10) : 0;
    };
    if (item.set_scheme && item.set_scheme.length > 0) {
        const rounds = Math.max(1, item.rounds ?? 1);
        const perRound = item.set_scheme.reduce((acc, s) => acc + parseReps(s.reps), 0);
        return perRound * rounds;
    }
    return (item.sets ?? 0) * parseReps(item.reps ?? '');
}

export function WorkoutItemRow({
    item,
    index,
    workoutId,
    onUpdate,
    onDelete,
    onDuplicate,
    onEditSets,
    onExitAdvanced,
    onEditNote,
    onEditWarmup,
    onEditCardio,
    drag,
    isActive,
}: WorkoutItemRowProps) {
    // Note/Warmup/Cardio items renderizam como rows dedicadas. Early return
    // ANTES de qualquer hook pra evitar hooks order mismatch entre tipos.
    if (item.item_type === 'note') {
        return (
            <NoteItemRow
                item={item}
                onEdit={onEditNote ?? (() => { })}
                onDelete={onDelete}
                drag={drag}
            />
        );
    }
    if (item.item_type === 'warmup') {
        return (
            <WarmupItemRow
                item={item}
                onEdit={onEditWarmup ?? (() => { })}
                onDelete={onDelete}
                drag={drag}
            />
        );
    }
    if (item.item_type === 'cardio') {
        return (
            <CardioItemRow
                item={item}
                onEdit={onEditCardio ?? (() => { })}
                onDelete={onDelete}
                drag={drag}
            />
        );
    }

    const colors = useV2Colors();
    const { isTablet } = useResponsive();
    const padding = isTablet ? 14 : 10;
    const inSuperset = item.parent_item_id !== null;
    const methodChip = methodChipLabel(item.method_key ?? null);
    const advancedActive = !!(item.set_scheme && item.set_scheme.length > 0);
    const rounds = item.rounds ?? 1;
    const phasesPerRound = item.set_scheme?.length ?? 0;
    const showRoundsBadge = advancedActive && rounds > 1 && phasesPerRound > 0;
    const swipeableRef = useRef<Swipeable>(null);

    const groupColor = useMemo(
        () => pickGroupColor(item.exercise_muscle_groups, colors),
        [item.exercise_muscle_groups, colors],
    );
    const setChips = useMemo(() => computeSetChips(item), [item]);
    const totalReps = useMemo(() => estimateTotalReps(item), [item]);
    const minutes = useMemo(() => estimateMinutes(item), [item]);

    /* Em modo avançado, o card inteiro vira tappable pra reabrir o sheet
     * do set scheme — antes a única forma era pelo pill "Modo simples", que
     * na verdade SAI do modo avançado e perde a prescrição. Fluxo agora:
     *
     * - Modo avançado: toque em qualquer área "neutra" do card → abre
     *   editor do scheme (igual ao "Editar séries" no modo simples).
     * - Botões filhos (drag, delete, pill "Modo simples") seguem capturando
     *   seus próprios toques — Pressable não recebe quando um filho
     *   touchable consome o evento primeiro.
     * - Modo simples: card não é tappable (os inputs Sets/Reps já são a
     *   affordance de edição). */
    const handleCardPress = () => {
        if (inSuperset) return;
        if (advancedActive && onEditSets) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEditSets();
        }
    };

    const renderRightActions = () => (
        <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8, marginBottom: 6 }}>
            {onEditSets && (
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        swipeableRef.current?.close();
                        onEditSets();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Editar séries"
                    style={{
                        width: 64,
                        backgroundColor: colors.semantic.info.default,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Edit3 size={16} color="#FFFFFF" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF', marginTop: 4 }}>
                        Editar
                    </Text>
                </TouchableOpacity>
            )}
            {onDuplicate && (
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        swipeableRef.current?.close();
                        onDuplicate();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Duplicar exercício"
                    style={{
                        width: 64,
                        backgroundColor: colors.purple[600],
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Copy size={16} color="#FFFFFF" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF', marginTop: 4 }}>
                        Duplicar
                    </Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    swipeableRef.current?.close();
                    onDelete();
                }}
                accessibilityRole="button"
                accessibilityLabel="Remover exercício"
                style={{
                    width: 64,
                    backgroundColor: colors.semantic.danger.default,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Trash2 size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF', marginTop: 4 }}>
                    Remover
                </Text>
            </TouchableOpacity>
        </View>
    );

    const cardContent = (
        <Animated.View
            entering={FadeInRight.delay(index * 30).duration(200)}
            style={{
                backgroundColor: isActive ? colors.purple[100] : colors.surface.card,
                borderRadius: 14,
                marginBottom: 6,
                borderWidth: 1,
                borderColor: isActive ? colors.purple[600] : colors.border.default,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isActive ? 0.08 : 0.03,
                shadowRadius: isActive ? 8 : 4,
                elevation: isActive ? 4 : 1,
                overflow: 'hidden',
                flexDirection: 'row',
            }}
        >
            {/* Color strip lateral (4px) por grupo muscular */}
            <View style={{
                width: 4,
                backgroundColor: groupColor,
            }} />

            <Pressable
                onPress={handleCardPress}
                disabled={!advancedActive || inSuperset}
                accessibilityRole={advancedActive ? "button" : undefined}
                accessibilityLabel={advancedActive ? "Editar séries do exercício" : undefined}
                style={({ pressed }) => ({
                    flex: 1,
                    padding,
                    opacity: pressed && advancedActive ? 0.85 : 1,
                })}
            >
                {/* Row 1: drag + name + sets/reps + delete */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* Drag handle ≡ sempre visível à esquerda */}
                    <TouchableOpacity
                        onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            drag?.();
                        }}
                        delayLongPress={150}
                        accessibilityLabel="Arrastar para reordenar"
                        style={{ padding: 3, marginRight: 6 }}
                    >
                        <GripVertical size={16} color={colors.text.quaternary} />
                    </TouchableOpacity>

                    {/* Exercise name (flex) */}
                    <Text
                        style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary, flex: 1 }}
                        numberOfLines={1}
                    >
                        {item.exercise_name}
                    </Text>

                    {/* Sets × Reps · Rest (inline) — escondido em modo avançado */}
                    {!advancedActive && (
                        <View style={{ marginLeft: 8 }}>
                            <SetRepsInput
                                sets={item.sets}
                                reps={item.reps}
                                restSeconds={item.rest_seconds}
                                onUpdate={(updates) => onUpdate(updates)}
                                compact
                            />
                        </View>
                    )}
                    {advancedActive && (
                        <Text
                            style={{ marginLeft: 8, fontSize: 11, fontWeight: "600", color: colors.text.secondary }}
                            numberOfLines={1}
                        >
                            {item.sets} × {item.reps} · {item.rest_seconds}s
                        </Text>
                    )}

                    {/* Delete (mantém atalho rápido — swipe é o flow primário) */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onDelete();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Remover exercício"
                        style={{ padding: 6, marginLeft: 4 }}
                    >
                        <Trash2 size={14} color={colors.semantic.danger.default} />
                    </TouchableOpacity>
                </View>

                {/* Row 2: muscle groups */}
                {item.exercise_muscle_groups.length > 0 && (
                    <Text
                        style={{
                            fontSize: 10,
                            color: colors.text.tertiary,
                            marginTop: 3,
                            marginLeft: 26,
                        }}
                        numberOfLines={1}
                    >
                        {item.exercise_muscle_groups.join(", ")}
                    </Text>
                )}

                {/* Row 3: strip horizontal de chips de séries */}
                {setChips.length > 0 && (
                    <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 4,
                        marginTop: 8,
                        marginLeft: 26,
                    }}>
                        {setChips.map((chip, i) => (
                            <View
                                key={`${chip.label}-${i}`}
                                style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    backgroundColor: colors.surface.card2,
                                    borderWidth: 1,
                                    borderColor: colors.border.subtle,
                                }}
                            >
                                <Text style={{
                                    fontSize: 10,
                                    fontWeight: '600',
                                    color: colors.text.secondary,
                                    letterSpacing: 0.2,
                                }}>
                                    {chip.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Row 4: chip do método + Editar séries (modo avançado).
                 *  flexWrap garante que em telas estreitas (iPhone SE) ou com
                 *  chips longos ("Cluster (rest-pause)" + "3 rodadas × 3 fases"
                 *  + "Modo simples") os badges quebrem pra linha de baixo em
                 *  vez de estourar a margem direita do card. */}
                {item.item_type === "exercise" && onEditSets && (
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: 6, marginTop: 6, marginLeft: 26 }}>
                        {methodChip && (
                            <View
                                style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 999,
                                    backgroundColor: colors.purple[100],
                                    marginRight: 8,
                                }}
                            >
                                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.purple[600] }}>
                                    {methodChip}
                                </Text>
                            </View>
                        )}
                        {showRoundsBadge && (
                            <View
                                style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 999,
                                    backgroundColor: "rgba(124, 58, 237, 0.06)",
                                    marginRight: 8,
                                }}
                            >
                                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.purple[600] }}>
                                    {rounds} rodadas × {phasesPerRound} fases
                                </Text>
                            </View>
                        )}
                        <TouchableOpacity
                            onPress={() => {
                                if (inSuperset) return;
                                if (advancedActive && onExitAdvanced) {
                                    Alert.alert(
                                        "Voltar para modo simples",
                                        "Você perderá as configurações específicas de cada série. Continuar?",
                                        [
                                            { text: "Cancelar", style: "cancel" },
                                            {
                                                text: "Voltar",
                                                style: "destructive",
                                                onPress: () => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    onExitAdvanced();
                                                },
                                            },
                                        ],
                                    );
                                    return;
                                }
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onEditSets?.();
                            }}
                            disabled={inSuperset}
                            accessibilityRole="button"
                            accessibilityLabel={
                                inSuperset
                                    ? "Não suportado dentro de superset"
                                    : advancedActive
                                    ? "Voltar para modo simples"
                                    : "Editar séries"
                            }
                            accessibilityState={{ disabled: inSuperset }}
                            style={{ flexDirection: "row", alignItems: "center", opacity: inSuperset ? 0.4 : 1 }}
                        >
                            <Sliders
                                size={11}
                                color={advancedActive ? colors.purple[600] : colors.text.tertiary}
                                style={{ marginRight: 4 }}
                            />
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: advancedActive ? colors.purple[600] : colors.text.tertiary,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                }}
                            >
                                {advancedActive ? "Modo simples" : "Editar séries"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Row 5: footer com métricas estimadas */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 8,
                    marginLeft: 26,
                }}>
                    {totalReps > 0 && (
                        <Text style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: '500' }}>
                            {totalReps} reps
                        </Text>
                    )}
                    {totalReps > 0 && (
                        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.text.quaternary }} />
                    )}
                    <Text style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: '500' }}>
                        ~{minutes} min
                    </Text>
                </View>
            </Pressable>
        </Animated.View>
    );

    // Sem swipe quando dentro de superset (Swipeable inutiliza o long-press do drag).
    if (inSuperset) return cardContent;

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            friction={2}
            rightThreshold={40}
        >
            {cardContent}
        </Swipeable>
    );
}
