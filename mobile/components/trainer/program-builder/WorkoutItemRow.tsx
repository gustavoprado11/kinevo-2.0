import React, { useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Alert } from "react-native";
import { GripVertical, Trash2, Sliders, Edit3, Copy, MoreHorizontal } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";
import { toRgba } from "@/lib/brandColor";
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
    /** Caminho padrão de edição (séries / reps / descanso) — bottomsheet
     *  rápido, sem entrar no editor de fases/métodos. Quando ausente, o
     *  tap do card cai no comportamento legado (abrir avançado). */
    onQuickEdit?: () => void;
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
    /** Trigger pra abrir o ExerciseActionsSheet (menu 3 dots). Disponível só
     *  em items do tipo 'exercise' fora de superset. */
    onOpenActions?: () => void;
    drag?: () => void;
    isActive?: boolean;
}

function withAlpha(hex: string, alpha = '1F'): string {
    return hex.length === 7 ? `${hex}${alpha}` : hex;
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
    onQuickEdit,
    onExitAdvanced,
    onEditNote,
    onEditWarmup,
    onEditCardio,
    onOpenActions,
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
    const totalReps = useMemo(() => estimateTotalReps(item), [item]);
    const minutes = useMemo(() => estimateMinutes(item), [item]);

    /* Card tap behavior:
     * - Modo simples: abre o QuickEditSheet (séries / reps / descanso).
     *   Default mais comum — ajuste rápido sem entrar nas fases.
     * - Modo avançado: abre o SetSchemeEditor (preserva fluxo legado, já
     *   que o trainer está em prescrição por fases).
     * - Botões filhos (drag, "...", pills) consomem o evento primeiro. */
    const handleCardPress = () => {
        if (inSuperset) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        if (advancedActive && onEditSets) {
            onEditSets();
            return;
        }
        if (onQuickEdit) {
            onQuickEdit();
        }
    };

    const renderRightActions = () => (
        <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8, marginBottom: 6 }}>
            {(onQuickEdit || onEditSets) && (
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        swipeableRef.current?.close();
                        // Swipe-quick action: simple mode → quick edit; advanced
                        // mode → set scheme editor.
                        if (advancedActive && onEditSets) onEditSets();
                        else if (onQuickEdit) onQuickEdit();
                        else onEditSets?.();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Editar exercício"
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
                backgroundColor: colors.surface.card,
                borderRadius: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderLeftWidth: 3,
                borderLeftColor: advancedActive ? colors.semantic.warning.default : groupColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 4,
                elevation: 1,
                overflow: 'hidden',
            }}
        >
            <Pressable
                onPress={handleCardPress}
                onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    drag?.();
                }}
                delayLongPress={150}
                accessibilityRole={advancedActive ? 'button' : undefined}
                accessibilityLabel={advancedActive ? 'Editar séries do exercício' : undefined}
                accessibilityHint="Mantenha pressionado pra reordenar"
                style={({ pressed }) => ({
                    padding: 14,
                    opacity: pressed && advancedActive ? 0.85 : 1,
                })}
            >
                {/* Row 1: drag affordance (decorativo) + nome + muscle tag + menu 3 dots.
                 *  O drag agora dispara via onLongPress do Pressable externo
                 *  (qualquer área do card), coerente com o pattern dos cards
                 *  Note/Warmup/Cardio que o Gustavo prefere. Mantemos o
                 *  GripVertical só como sinal visual. */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ padding: 2, marginRight: 8 }}>
                        <GripVertical size={14} color={colors.text.quaternary} />
                    </View>

                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: '800',
                                letterSpacing: -0.15,
                                color: colors.text.primary,
                                lineHeight: 18,
                                flexShrink: 1,
                            }}
                            numberOfLines={1}
                        >
                            {item.exercise_name}
                        </Text>
                        {item.exercise_muscle_groups.length > 0 && (
                            <View
                                style={{
                                    backgroundColor: withAlpha(groupColor),
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderRadius: 100,
                                    flexShrink: 0,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 10,
                                        fontWeight: '700',
                                        color: groupColor,
                                        letterSpacing: 0.3,
                                    }}
                                    numberOfLines={1}
                                >
                                    {item.exercise_muscle_groups.join(' · ')}
                                </Text>
                            </View>
                        )}
                    </View>

                    {!inSuperset && onOpenActions && (
                        <TouchableOpacity
                            onPress={onOpenActions}
                            accessibilityRole="button"
                            accessibilityLabel="Opções do exercício"
                            hitSlop={6}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                marginLeft: 8,
                            }}
                        >
                            <MoreHorizontal size={16} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Row 2: Hero Stats (modo simples) OR Pirâmide Strip (avançado) */}
                {!advancedActive ? (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'stretch',
                            gap: 12,
                            backgroundColor: toRgba(colors.purple[600], 0.06),
                            borderWidth: 1,
                            borderColor: toRgba(colors.purple[600], 0.14),
                            borderRadius: 12,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            marginTop: 10,
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 22,
                                    fontWeight: '900',
                                    letterSpacing: -0.88,
                                    color: colors.purple[400],
                                    lineHeight: 22,
                                }}
                            >
                                {item.sets} × {item.reps}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 9,
                                    fontWeight: '800',
                                    letterSpacing: 1.35,
                                    color: colors.text.tertiary,
                                    textTransform: 'uppercase',
                                    marginTop: 4,
                                }}
                            >
                                SÉRIES × REPS
                            </Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: toRgba(colors.purple[600], 0.18) }} />
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: '800',
                                    letterSpacing: -0.32,
                                    color: colors.text.primary,
                                    lineHeight: 16,
                                }}
                            >
                                {item.rest_seconds}s
                            </Text>
                            <Text
                                style={{
                                    fontSize: 9,
                                    fontWeight: '700',
                                    letterSpacing: 1.08,
                                    color: colors.text.tertiary,
                                    textTransform: 'uppercase',
                                    marginTop: 3,
                                }}
                            >
                                DESCANSO
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
                        {item.set_scheme!.map((set, i) => (
                            <View
                                key={i}
                                style={{
                                    flex: 1,
                                    padding: 6,
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(244,196,78,0.08)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(244,196,78,0.18)',
                                    borderRadius: 6,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: '800',
                                        letterSpacing: -0.28,
                                        color: colors.semantic.warning.default,
                                    }}
                                >
                                    {set.reps}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 8,
                                        fontWeight: '700',
                                        letterSpacing: 0.4,
                                        color: colors.text.quaternary,
                                        marginTop: 1,
                                    }}
                                >
                                    REP
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Row 3 (footer): método tag + rounds + meta + edit link */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 10,
                        gap: 8,
                    }}
                >
                    <View
                        style={{
                            flexShrink: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                            rowGap: 4,
                        }}
                    >
                        {methodChip && (
                            <View
                                style={{
                                    backgroundColor: 'rgba(244,196,78,0.14)',
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderRadius: 100,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 9,
                                        fontWeight: '800',
                                        letterSpacing: 0.5,
                                        color: colors.semantic.warning.default,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    {methodChip}
                                </Text>
                            </View>
                        )}
                        {showRoundsBadge && (
                            <View
                                style={{
                                    backgroundColor: toRgba(colors.purple[600], 0.10),
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderRadius: 100,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 9,
                                        fontWeight: '800',
                                        color: colors.purple[600],
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    {rounds}×{phasesPerRound} fases
                                </Text>
                            </View>
                        )}
                        {totalReps > 0 && (
                            <Text style={{ fontSize: 11, color: colors.text.tertiary, fontWeight: '500' }}>
                                {totalReps} reps · ~{minutes} min
                            </Text>
                        )}
                    </View>
                    {item.item_type === 'exercise' && (onEditSets || onQuickEdit) && (
                        <TouchableOpacity
                            onPress={() => {
                                if (inSuperset) return;
                                if (advancedActive && onExitAdvanced) {
                                    Alert.alert(
                                        'Voltar para modo simples',
                                        'Você perderá as configurações específicas de cada série. Continuar?',
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            {
                                                text: 'Voltar',
                                                style: 'destructive',
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
                                if (onQuickEdit) onQuickEdit();
                                else onEditSets?.();
                            }}
                            disabled={inSuperset}
                            accessibilityRole="button"
                            accessibilityLabel={advancedActive ? 'Voltar para modo simples' : 'Editar séries, reps e descanso'}
                            style={{ paddingVertical: 4, paddingHorizontal: 6, opacity: inSuperset ? 0.4 : 1 }}
                        >
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: '800',
                                    color: colors.purple[400],
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                }}
                            >
                                {advancedActive ? 'Modo simples' : 'Editar'}
                            </Text>
                        </TouchableOpacity>
                    )}
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
