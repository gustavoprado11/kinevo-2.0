import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import {
    ArrowRightLeft,
    PlayCircle,
    TrendingUp,
    TrendingDown,
    ChevronsDown,
    Layers,
    Dumbbell,
    Pencil,
} from 'lucide-react-native';
import type { MethodKey } from '@kinevo/shared/types/prescription';
import { getMethodChipLabel } from '@kinevo/shared/lib/prescription/method-labels';
import { ExerciseBody, computeRoundLayout } from './ExerciseBody';
import type { SetData, PreviousSetData } from './ExerciseBody';
import { TrainerNote } from './TrainerNote';
import type { SetPrescription } from '../../lib/hydrateWorkoutSets';
import { useV2Colors, useIsDark } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

// Tipos reexportados do corpo extraído (Fase 0) — compat com quem importava daqui.
export type { SetData, PreviousSetData };

interface ExerciseCardProps {
    exerciseName: string;
    sets: number;
    reps: string;
    restSeconds: number;
    setsData: SetData[];
    /** Local (per-card) set-change callback. Optional when the stable
     *  onSetChangeGlobal + globalIndex pair is supplied instead. */
    onSetChange?: (index: number, field: 'weight' | 'reps', value: string) => void;
    /** Local (per-card) toggle callback. Optional when onToggleSetCompleteGlobal
     *  + globalIndex is supplied instead. */
    onToggleSetComplete?: (index: number) => void;
    /** When provided, the card forwards its position so the parent can pass a
     *  single stable callback instead of allocating per-card closures every
     *  render (perf: the live workout list). Used by the workout player. */
    globalIndex?: number;
    /** Stable variant of onSetChange — receives the card's globalIndex so the
     *  parent callback identity never changes between renders. Takes priority
     *  over onSetChange when globalIndex is provided. */
    onSetChangeGlobal?: (globalIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => void;
    /** Stable variant of onToggleSetComplete (see onSetChangeGlobal). */
    onToggleSetCompleteGlobal?: (globalIndex: number, setIndex: number) => void;
    /** Stable variant of onSwapPress — receives the card's globalIndex. */
    onSwapPressGlobal?: (globalIndex: number) => void;
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
    /** Rodadas (Fase 4.3). > 1 ativa o agrupamento por rodada na lista de
     *  séries. Default 1 (comportamento atual). */
    rounds?: number;
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

export const ExerciseCard = React.memo(function ExerciseCard({
    exerciseName,
    sets,
    reps,
    restSeconds,
    setsData,
    onSetChange,
    onToggleSetComplete,
    globalIndex,
    onSetChangeGlobal,
    onToggleSetCompleteGlobal,
    onSwapPressGlobal,
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
    rounds = 1,
    readOnly = false,
}: ExerciseCardProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    // Perf: when the parent supplies the stable *Global callbacks + a
    // globalIndex, bind them here so the parent never allocates per-card
    // closures. Falls back to the local per-card callbacks otherwise (the
    // builder preview / training-room / superset wrapper paths).
    const handleSetChange = React.useCallback(
        (setIndex: number, field: 'weight' | 'reps', value: string) => {
            if (onSetChangeGlobal && globalIndex !== undefined) {
                onSetChangeGlobal(globalIndex, setIndex, field, value);
            } else {
                onSetChange?.(setIndex, field, value);
            }
        },
        [onSetChangeGlobal, globalIndex, onSetChange],
    );

    const handleToggleSetComplete = React.useCallback(
        (setIndex: number) => {
            if (onToggleSetCompleteGlobal && globalIndex !== undefined) {
                onToggleSetCompleteGlobal(globalIndex, setIndex);
            } else {
                onToggleSetComplete?.(setIndex);
            }
        },
        [onToggleSetCompleteGlobal, globalIndex, onToggleSetComplete],
    );

    const handleSwapPress = React.useCallback(() => {
        if (onSwapPressGlobal && globalIndex !== undefined) {
            onSwapPressGlobal(globalIndex);
        } else {
            onSwapPress?.();
        }
    }, [onSwapPressGlobal, globalIndex, onSwapPress]);

    const handleOpenVideo = () => {
        if (videoUrl) {
            onVideoPress?.(videoUrl);
        } else {
            Alert.alert("Vídeo indisponível", "Este exercício não possui vídeo cadastrado.");
        }
    };

    const hasScheme = Array.isArray(setScheme) && setScheme.length > 0;
    const summary = hasScheme ? buildSchemeSummary(setScheme!) : null;
    const methodChip = getMethodChipLabel(methodKey);

    // Layout composto (rounds) — fonte única compartilhada com o ExerciseBody
    // (que renderiza as rodadas). Aqui só precisamos de isCompoundLayout +
    // phasesPerRound para o resumo textual do header.
    const { isCompoundLayout, phasesPerRound } = computeRoundLayout(setScheme, rounds);

    // Header summary: "3 rodadas · 2 fases · 10/8 reps" for compound; legacy
    // "N séries · X reps · Ys descanso" for linear.
    let headerSummary: string;
    if (isCompoundLayout) {
        const firstRoundReps = setScheme!.slice(0, phasesPerRound).map((s) => s.reps_target.trim() || '0').join('/');
        headerSummary = `${rounds} rodadas · ${phasesPerRound} fases · ${firstRoundReps} reps`;
    } else if (hasScheme) {
        headerSummary = `${setScheme!.length} séries • ${summary!.reps} reps • ${summary!.rest}s descanso`;
    } else {
        headerSummary = `${sets} séries • ${reps} reps • ${restSeconds}s descanso`;
    }
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
            tint={isDark ? 'dark' : 'light'}
            className="rounded-2xl"
            style={{
                overflow: 'hidden',
                backgroundColor: colors.surface.glass,
                borderWidth: 1,
                borderColor: colors.border.subtle,
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
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary, flexShrink: 1 }}>
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
                                    backgroundColor: toRgba(colors.purple[600], 0.12),
                                    borderWidth: 1,
                                    borderColor: toRgba(colors.purple[600], 0.25),
                                }}
                            >
                                <MethodIcon size={11} color={colors.purple[700]} strokeWidth={2.4} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[700], letterSpacing: 0.2 }}>
                                    {methodChip}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
                        {headerSummary}
                    </Text>
                    {/* Fallback: show "Carga anterior" only when per-set data is unavailable */}
                    {!previousSets?.length && previousLoad && (
                        <Text style={{ color: colors.text.tertiary, fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>
                            Carga anterior: {previousLoad}
                        </Text>
                    )}
                    {isSwapped && (
                        <Text style={{ color: colors.purple[600], fontSize: 11, marginTop: 2 }}>
                            Exercício substituído nesta sessão
                        </Text>
                    )}
                    {supersetBadge && (
                        <Text style={{ color: colors.purple[600], fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                            {supersetBadge}
                        </Text>
                    )}
                    {notes ? <TrainerNote note={notes} /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!readOnly && (
                        <TouchableOpacity
                            onPress={handleSwapPress}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: toRgba(colors.purple[600], 0.1) }}
                        >
                            <ArrowRightLeft size={18} color={colors.purple[600]} />
                        </TouchableOpacity>
                    )}
                    {!readOnly && (
                        <TouchableOpacity
                            onPress={handleOpenVideo}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: toRgba(colors.purple[600], 0.1) }}
                        >
                            <PlayCircle size={18} color={colors.purple[600]} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Corpo (cabeçalhos + grade de séries, incl. layout por rodadas) —
                extraído para ExerciseBody (Fase 0) e reusado pelos dois modos. */}
            <ExerciseBody
                setsData={setsData}
                setScheme={setScheme}
                rounds={rounds}
                restSeconds={restSeconds}
                previousSets={previousSets}
                readOnly={readOnly}
                onSetChange={handleSetChange}
                onToggleSetComplete={handleToggleSetComplete}
            />
        </BlurView>
    );
});
