/**
 * JourneyCard — card editorial do topo da aba Desempenho.
 *
 * Substitui o antigo "Sua Jornada" de 3 anéis. Número herói (treinos) +
 * mini-bars das últimas 8 semanas + 3 linhas calmas (Volume / Tempo /
 * Sequência). Estado vazio editorial quando não há treinos.
 *
 * Spec: handoff-historico/SPEC.md §"Aba 2 — Desempenho".
 */
import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Dumbbell, Clock, CheckCircle2 } from 'lucide-react-native';
import { ANIM } from '../../lib/animations';
import { useV2Colors, useIsDark } from '../../hooks/useV2Colors';
import { MiniBars } from './MiniBars';
import { StatRow } from './StatRow';
import {
    formatTon,
    formatHours,
    formatJourneyStart,
    type JourneyData,
} from '../../lib/history';

export function JourneyCard({ data }: { data: JourneyData }) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    const eyebrow = {
        fontSize: 12,
        fontWeight: '700' as const,
        color: colors.text.tertiary,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
    };

    const cardStyle = {
        backgroundColor: colors.surface.card,
        borderRadius: 20,
        padding: 22,
        paddingTop: 24,
        paddingBottom: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border.default,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    };

    // Estado vazio editorial.
    if (data.totalWorkouts === 0) {
        return (
            <Animated.View
                entering={FadeInUp.delay(100).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
                style={cardStyle}
            >
                <Text accessibilityLabel="Sua jornada" style={[eyebrow, { marginBottom: 16 }]}>
                    Sua Jornada
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.3 }}>
                    Comece sua jornada
                </Text>
                <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 6, lineHeight: 19 }}>
                    Registre seu primeiro treino — suas estatísticas aparecem aqui.
                </Text>
            </Animated.View>
        );
    }

    const barActive = isDark ? '#A78BFA' : '#7C3AED';
    const barEmpty = isDark ? 'rgba(255,255,255,0.08)' : '#EDE9FE';
    const showStreak = data.streakDays > 0;

    return (
        <Animated.View
            entering={FadeInUp.delay(100).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
            style={cardStyle}
        >
            <Text accessibilityLabel="Sua jornada" style={[eyebrow, { marginBottom: 16 }]}>
                Sua Jornada
            </Text>

            {/* Hero + mini-bars */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 64,
                            fontWeight: '800',
                            letterSpacing: -2.5,
                            lineHeight: 64,
                            color: colors.text.primary,
                            fontVariant: ['tabular-nums'],
                        }}
                    >
                        {data.totalWorkouts}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 6 }}>
                        treinos completos
                    </Text>
                    {data.firstWorkoutDate ? (
                        <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 1 }}>
                            {formatJourneyStart(data.firstWorkoutDate)}
                        </Text>
                    ) : null}
                </View>

                <View style={{ alignItems: 'flex-end', paddingTop: 6 }}>
                    <MiniBars
                        counts={data.weeklyWorkoutCounts}
                        activeColor={barActive}
                        emptyColor={barEmpty}
                    />
                    <Text
                        style={{
                            fontSize: 9.5,
                            fontWeight: '700',
                            color: colors.text.quaternary,
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                            marginTop: 6,
                        }}
                    >
                        Últimas 8 semanas
                    </Text>
                </View>
            </View>

            {/* Divider */}
            <View
                style={{
                    height: 1,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#ECECF0',
                    marginTop: 18,
                }}
            />

            {/* Métricas */}
            <StatRow
                icon={Dumbbell}
                label="Volume"
                sub="acumulado"
                value={formatTon(data.volumeKg, 0)}
                unit="t"
            />
            <StatRow
                icon={Clock}
                label="Tempo"
                sub={`~${data.avgMinutesPerWorkout} min por treino`}
                value={formatHours(data.totalDurationSec)}
                unit="h"
                last={!showStreak}
            />
            {showStreak ? (
                <StatRow
                    icon={CheckCircle2}
                    label="Sequência"
                    sub={`treinou ${data.activeDaysLast7} dos últimos 7 dias`}
                    value={String(data.streakDays)}
                    unit="d"
                    last
                />
            ) : null}
        </Animated.View>
    );
}
