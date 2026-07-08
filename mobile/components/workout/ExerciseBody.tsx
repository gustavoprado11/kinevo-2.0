import React from 'react';
import { View, Text } from 'react-native';
import { Check } from 'lucide-react-native';
import { RestConnector } from './RestConnector';
import { SetRow } from './SetRow';
import type { SetPrescription } from '../../lib/hydrateWorkoutSets';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

/**
 * ExerciseBody — o CORPO de um exercício de força (cabeçalhos de coluna + grade
 * de séries, incluindo o layout composto por rodadas). Extraído do ExerciseCard
 * (Fase 0 do redesign lista/foco) para ser reutilizado pelos dois modos de
 * execução sem duplicar a lógica de rounds/set_scheme.
 *
 * É agnóstico ao "chrome" (moldura, header, chip de método, botões de swap/vídeo)
 * — isso continua no container (ExerciseCard / futura página de foco). Recebe os
 * callbacks JÁ resolvidos (o container os liga ao globalIndex), então este
 * componente nunca precisa saber sobre local-vs-global.
 */

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

export interface RoundLayout {
    /** true quando rounds > 1 e o scheme tem round_number → agrupa por rodada. */
    isCompoundLayout: boolean;
    /** fases por rodada (só válido em compound). */
    phasesPerRound: number;
    /** índices (flat) do set_scheme agrupados por round_number real (fix M5). */
    roundGroups: number[][];
}

/**
 * Deriva o layout composto (rounds) a partir do set_scheme. Função PURA — usada
 * pelo corpo (render das rodadas) E pelo header do ExerciseCard (resumo textual),
 * para que exista uma fonte única do agrupamento por rodada.
 *
 * M5: agrupa por round_number REAL (fallback posicional) em vez de fatiar por
 * `phasesPerRound`. Sem isto, quando setScheme.length não é divisível por rounds
 * (ex.: 5 séries / 2 rodadas) as séries excedentes não eram renderizadas.
 */
export function computeRoundLayout(
    setScheme: SetPrescription[] | null | undefined,
    rounds: number,
): RoundLayout {
    const hasScheme = Array.isArray(setScheme) && setScheme.length > 0;
    const isCompoundLayout =
        hasScheme && rounds > 1 && setScheme!.some((s) => typeof s.round_number === 'number');
    const phasesPerRound = isCompoundLayout ? Math.max(1, Math.floor(setScheme!.length / rounds)) : 0;
    const roundGroups: number[][] = (() => {
        if (!isCompoundLayout) return [];
        const byRound = new Map<number, number[]>();
        setScheme!.forEach((s, idx) => {
            const r =
                typeof s.round_number === 'number'
                    ? s.round_number
                    : Math.floor(idx / Math.max(1, phasesPerRound)) + 1;
            if (!byRound.has(r)) byRound.set(r, []);
            byRound.get(r)!.push(idx);
        });
        return [...byRound.keys()].sort((a, b) => a - b).map((k) => byRound.get(k)!);
    })();
    return { isCompoundLayout, phasesPerRound, roundGroups };
}

interface ExerciseBodyProps {
    setsData: SetData[];
    setScheme?: SetPrescription[] | null;
    /** Rodadas (> 1 ativa o agrupamento por rodada). Default 1. */
    rounds?: number;
    /** Descanso agregado (usado no connector quando não há scheme per-set). */
    restSeconds: number;
    previousSets?: PreviousSetData[];
    readOnly?: boolean;
    /** Callbacks JÁ resolvidos pelo container (ligados ao globalIndex). */
    onSetChange: (setIndex: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSetComplete: (setIndex: number) => void;
}

export const ExerciseBody = React.memo(function ExerciseBody({
    setsData,
    setScheme,
    rounds = 1,
    restSeconds,
    previousSets,
    readOnly = false,
    onSetChange,
    onToggleSetComplete,
}: ExerciseBodyProps) {
    const colors = useV2Colors();
    const hasScheme = Array.isArray(setScheme) && setScheme.length > 0;
    const { isCompoundLayout, roundGroups } = computeRoundLayout(setScheme, rounds);

    return (
        <>
            {/* Column Headers */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 2 }}>
                <View style={{ width: 26, marginRight: 6 }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>#</Text>
                </View>
                <View style={{ width: 58, marginRight: 6 }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>Anterior</Text>
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>Peso</Text>
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={{ color: colors.text.tertiary, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>Reps</Text>
                </View>
                <View style={{ width: 40, alignItems: 'center' }}>
                    <Check size={10} color={colors.text.tertiary} />
                </View>
            </View>

            {/* Sets List */}
            <View>
                {isCompoundLayout
                    ? roundGroups.map((indices, roundIdx) => {
                        const roundSlice = indices.map((i) => setsData[i]).filter(Boolean);
                        const allDone = roundSlice.length > 0 && roundSlice.every((s) => s.completed);
                        const isLastRound = roundIdx === roundGroups.length - 1;
                        return (
                            <View
                                key={`round-${roundIdx + 1}`}
                                style={{
                                    marginTop: roundIdx === 0 ? 0 : 10,
                                    paddingTop: roundIdx === 0 ? 0 : 6,
                                    borderTopWidth: roundIdx === 0 ? 0 : 1,
                                    borderTopColor: toRgba(colors.purple[600], 0.12),
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple[700], letterSpacing: 0.4, textTransform: 'uppercase' }}>
                                        Rodada {roundIdx + 1} de {roundGroups.length}
                                    </Text>
                                    <View
                                        accessibilityLabel={allDone ? 'Rodada concluída' : 'Rodada em andamento'}
                                        style={{
                                            width: 18,
                                            height: 18,
                                            borderRadius: 9,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: allDone ? colors.purple[600] : 'transparent',
                                            borderWidth: allDone ? 0 : 1.5,
                                            borderColor: colors.border.default,
                                        }}
                                    >
                                        {allDone ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                                    </View>
                                </View>
                                {indices.map((globalIdx, localIdx) => {
                                    const set = setsData[globalIdx];
                                    if (!set) return null;
                                    const prev = previousSets?.[globalIdx];
                                    const prescription = setScheme![globalIdx];
                                    const nextPrescription = setScheme![globalIdx + 1];
                                    const isLastPhaseInRound = localIdx === indices.length - 1;
                                    const isLastInExercise = isLastPhaseInRound && isLastRound;
                                    const isLastInRound = isLastPhaseInRound && !isLastRound;
                                    return (
                                        <React.Fragment key={globalIdx}>
                                            <SetRow
                                                index={globalIdx}
                                                weight={set.weight}
                                                reps={set.reps}
                                                isCompleted={set.completed}
                                                onWeightChange={(val) => onSetChange(globalIdx, 'weight', val)}
                                                onRepsChange={(val) => onSetChange(globalIdx, 'reps', val)}
                                                onToggleComplete={() => onToggleSetComplete(globalIdx)}
                                                previousWeight={prev?.weight}
                                                previousReps={prev?.reps}
                                                setType={prescription?.set_type ?? 'normal'}
                                                repsTarget={prescription?.reps_target}
                                                weightTargetKg={prescription?.weight_target_kg ?? null}
                                                weightTargetPct1rm={prescription?.weight_target_pct1rm ?? null}
                                                rirTarget={prescription?.rir ?? null}
                                                tempoTarget={prescription?.tempo ?? null}
                                                readOnly={readOnly}
                                            />
                                            <RestConnector
                                                restSeconds={prescription?.rest_seconds ?? 0}
                                                currentSetType={prescription?.set_type ?? 'normal'}
                                                nextSetType={nextPrescription?.set_type}
                                                isLastInRound={isLastInRound}
                                                isLastInExercise={isLastInExercise}
                                            />
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                        );
                    })
                    : setsData.map((set, index) => {
                        const prev = previousSets?.[index];
                        const prescription = hasScheme ? setScheme![index] : null;
                        const nextPrescription = hasScheme ? setScheme![index + 1] : null;
                        const isLast = index === setsData.length - 1;
                        // Rest a usar pro connector. Per-set se houver scheme, senão o agregado uniforme.
                        const restForConnector = prescription?.rest_seconds ?? restSeconds;
                        return (
                            <React.Fragment key={index}>
                                <SetRow
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
                                    weightTargetKg={prescription?.weight_target_kg ?? null}
                                    weightTargetPct1rm={prescription?.weight_target_pct1rm ?? null}
                                    rirTarget={prescription?.rir ?? null}
                                    tempoTarget={prescription?.tempo ?? null}
                                    readOnly={readOnly}
                                />
                                <RestConnector
                                    restSeconds={restForConnector}
                                    currentSetType={prescription?.set_type ?? 'normal'}
                                    nextSetType={nextPrescription?.set_type}
                                    isLastInExercise={isLast}
                                />
                            </React.Fragment>
                        );
                    })}
            </View>
        </>
    );
});
