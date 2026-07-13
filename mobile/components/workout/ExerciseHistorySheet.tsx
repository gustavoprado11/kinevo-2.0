/**
 * ExerciseHistorySheet — últimas execuções de um exercício, sem sair do treino.
 *
 * Nasce servindo as duas telas: a Sala de Treino (o treinador vê o histórico do
 * aluno ativo) e a execução do aluno (vê o próprio). Até aqui as duas só sabiam
 * da última sessão, na coluna "Anterior" de cada série.
 *
 * Ordem de leitura: resumo (melhor carga, última vez e a variação) → progressão
 * → sessões série a série. Quem abre no meio de uma série quer decidir a carga,
 * não estudar um gráfico.
 *
 * Gotcha RN 0.81/Fabric: Pressable com style OBJETO (nunca style-função inline),
 * senão backgroundColor/flex não pintam.
 */
import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { X, LineChart, TrendingUp, Award } from 'lucide-react-native';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';
import { useExerciseHistory, EXERCISE_HISTORY_SESSIONS } from '../../hooks/useExerciseHistory';
import type { ExerciseHistorySession } from '@kinevo/shared/lib/exercise-history';

interface ExerciseHistorySheetProps {
    visible: boolean;
    onClose: () => void;
    exerciseName: string;
    /** Exercício EXECUTADO (sobrevive a troca de programa e a substituição). */
    exerciseId: string | null | undefined;
    studentId: string | null | undefined;
    /** Primeiro nome do aluno — presente na Sala; ausente na tela do próprio aluno. */
    studentName?: string | null;
}

/** "42,5" (sem casa decimal quando é inteiro). */
function formatWeight(kg: number): string {
    return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace('.', ',');
}

/**
 * Quando foi a execução, do jeito que se fala no treino: "há 6 dias" enquanto
 * isso ainda é uma referência útil, "12/05" quando já virou data. (O timeAgo
 * genérico do app vira data cheia depois de uma semana — "29/06/2026" no meio
 * de uma lista de cargas é ruído.)
 */
function formatWhen(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'hoje';
    if (days === 1) return 'ontem';
    if (days < 30) return `há ${days} dias`;
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        ...(sameYear ? {} : { year: '2-digit' }),
    });
}

function setLabel(weight: number, reps: number): string {
    if (weight <= 0) return `${reps} reps`;
    return `${formatWeight(weight)}×${reps}`;
}

export function ExerciseHistorySheet({
    visible,
    onClose,
    exerciseName,
    exerciseId,
    studentId,
    studentName,
}: ExerciseHistorySheetProps) {
    const colors = useV2Colors();
    // Só busca quando o sheet está aberto — nada é carregado ao entrar no treino.
    const { history, isLoading, error } = useExerciseHistory(
        visible ? studentId : null,
        visible ? exerciseId : null,
    );
    const { sessions, best, last, deltaKg } = history;

    const subtitle = (() => {
        if (isLoading) return 'Carregando execuções…';
        const n = sessions.length;
        const dono = studentName ? ` de ${studentName.split(' ')[0]}` : '';
        if (n === 0) return `Nenhuma execução registrada${dono}`;
        if (n === 1) return `Primeira execução registrada${dono}`;
        return `Últimas ${Math.min(n, EXERCISE_HISTORY_SESSIONS)} execuções${dono}`;
    })();

    // Com uma única execução não há comparação: "melhor carga" e "última vez"
    // seriam o mesmo número, e o selo de recorde não significa nada.
    const hasComparison = sessions.length >= 2;

    // Barras de progressão: a carga da melhor série de cada sessão, da mais
    // antiga (esquerda) para a mais recente (direita) — é como o olho lê evolução.
    const bars = [...sessions].reverse().filter((s) => (s.topSet?.weight ?? 0) > 0);
    const maxWeight = bars.reduce((max, s) => Math.max(max, s.topSet?.weight ?? 0), 0);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
            >
                <Pressable
                    onPress={() => {}}
                    style={{
                        backgroundColor: colors.surface.card,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingTop: 10,
                        paddingBottom: 34,
                        paddingHorizontal: 18,
                        maxHeight: '82%',
                    }}
                >
                    <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.surface.card2, marginBottom: 14 }} />

                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text.primary }} numberOfLines={2}>
                                {exerciseName}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: colors.text.tertiary, marginTop: 2 }}>
                                {subtitle}
                            </Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar histórico"
                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={18} color={colors.text.secondary} />
                        </Pressable>
                    </View>

                    {isLoading ? (
                        <View style={{ paddingVertical: 46, alignItems: 'center' }}>
                            <ActivityIndicator color={colors.purple[600]} />
                        </View>
                    ) : error ? (
                        <EmptyBlock
                            title="Não foi possível carregar"
                            message={error}
                            colors={colors}
                        />
                    ) : sessions.length === 0 ? (
                        <EmptyBlock
                            title="Nenhuma execução registrada"
                            message="Quando este exercício for concluído, as séries aparecem aqui para comparação."
                            colors={colors}
                        />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Resumo */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {hasComparison && best?.set ? (
                                    <View style={{ flex: 1, backgroundColor: colors.surface.card2, borderRadius: 14, padding: 11 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Award size={11} color={colors.semantic.success.default} />
                                            <Text style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: colors.text.tertiary }}>
                                                MELHOR CARGA
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.semantic.success.default, marginTop: 3, fontVariant: ['tabular-nums'] }}>
                                            {setLabel(best.set.weight, best.set.reps)}
                                        </Text>
                                        <Text style={{ fontSize: 10.5, color: colors.text.tertiary, marginTop: 1 }}>
                                            {formatWhen(best.completedAt)}
                                        </Text>
                                    </View>
                                ) : null}

                                {last?.topSet ? (
                                    <View style={{ flex: 1, backgroundColor: colors.surface.card2, borderRadius: 14, padding: 11 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <TrendingUp size={11} color={colors.text.tertiary} />
                                            <Text style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: colors.text.tertiary }}>
                                                ÚLTIMA VEZ
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text.primary, marginTop: 3, fontVariant: ['tabular-nums'] }}>
                                            {setLabel(last.topSet.weight, last.topSet.reps)}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 10.5,
                                                marginTop: 1,
                                                fontWeight: deltaKg ? '700' : '400',
                                                color:
                                                    deltaKg && deltaKg > 0
                                                        ? colors.semantic.success.default
                                                        : deltaKg && deltaKg < 0
                                                          ? colors.semantic.warning.default
                                                          : colors.text.tertiary,
                                            }}
                                        >
                                            {deltaKg === null || deltaKg === 0
                                                ? formatWhen(last.completedAt)
                                                : `${deltaKg > 0 ? '+' : '−'}${formatWeight(Math.abs(deltaKg))} kg vs. a anterior`}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Progressão — carga da melhor série por sessão */}
                            {bars.length >= 2 && maxWeight > 0 ? (
                                <View style={{ marginTop: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 62, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, paddingBottom: 2 }}>
                                        {bars.map((session, i) => {
                                            const weight = session.topSet?.weight ?? 0;
                                            const isBest = best?.sessionId === session.sessionId;
                                            const isLast = i === bars.length - 1;
                                            return (
                                                <View key={session.sessionId} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                                                    <View
                                                        style={{
                                                            width: '100%',
                                                            height: Math.max(8, (weight / maxWeight) * 42),
                                                            borderTopLeftRadius: 4,
                                                            borderTopRightRadius: 4,
                                                            backgroundColor: isBest
                                                                ? colors.semantic.success.default
                                                                : isLast
                                                                  ? colors.purple[600]
                                                                  : toRgba(colors.purple[600], 0.3),
                                                        }}
                                                    />
                                                    <Text style={{ fontSize: 8.5, color: colors.text.tertiary, fontVariant: ['tabular-nums'] }}>
                                                        {formatWeight(weight)}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}

                            {/* Sessões */}
                            <View style={{ gap: 8, marginTop: 14 }}>
                                {sessions.map((session) => (
                                    <SessionRow
                                        key={session.sessionId}
                                        session={session}
                                        isBest={hasComparison && best?.sessionId === session.sessionId}
                                        bestWeight={best?.set.weight ?? 0}
                                        colors={colors}
                                    />
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function SessionRow({
    session,
    isBest,
    bestWeight,
    colors,
}: {
    session: ExerciseHistorySession;
    isBest: boolean;
    bestWeight: number;
    colors: ReturnType<typeof useV2Colors>;
}) {
    const success = colors.semantic.success.default;
    return (
        <View
            style={{
                backgroundColor: colors.surface.card2,
                borderRadius: 14,
                padding: 11,
                gap: 8,
                borderWidth: isBest ? 1 : 0,
                borderColor: isBest ? toRgba(success, 0.35) : 'transparent',
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text.primary }}>
                        {formatWhen(session.completedAt)}
                    </Text>
                    {isBest ? (
                        <View style={{ backgroundColor: toRgba(success, 0.12), borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4, color: success }}>
                                MELHOR CARGA
                            </Text>
                        </View>
                    ) : null}
                </View>
                {session.workoutName ? (
                    <Text style={{ fontSize: 10, color: colors.text.tertiary, flexShrink: 1 }} numberOfLines={1}>
                        {session.workoutName}
                    </Text>
                ) : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {session.sets.map((s) => {
                    const isTop = bestWeight > 0 && s.weight === bestWeight && isBest;
                    return (
                        <View
                            key={s.setNumber}
                            style={{
                                borderRadius: 7,
                                borderWidth: 1,
                                borderColor: isTop ? toRgba(success, 0.35) : colors.border.subtle,
                                backgroundColor: toRgba(colors.text.primary, 0.04),
                                paddingHorizontal: 7,
                                paddingVertical: 3,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: '600',
                                    color: isTop ? success : colors.text.secondary,
                                    fontVariant: ['tabular-nums'],
                                }}
                            >
                                {setLabel(s.weight, s.reps)}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

function EmptyBlock({
    title,
    message,
    colors,
}: {
    title: string;
    message: string;
    colors: ReturnType<typeof useV2Colors>;
}) {
    return (
        <View style={{ alignItems: 'center', gap: 7, paddingVertical: 34, paddingHorizontal: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center' }}>
                <LineChart size={20} color={colors.text.tertiary} />
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text.primary }}>{title}</Text>
            <Text style={{ fontSize: 11.5, color: colors.text.tertiary, textAlign: 'center', lineHeight: 17, maxWidth: 260 }}>
                {message}
            </Text>
        </View>
    );
}
