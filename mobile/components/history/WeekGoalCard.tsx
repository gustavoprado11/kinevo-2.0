/**
 * WeekGoalCard — card dark premium do topo da aba Histórico.
 *
 * Substitui o antigo "Esta Semana" roxo gradiente. Anel de meta semanal +
 * linha narrativa contextual + 3 métricas com rótulos explícitos (Volume /
 * Séries / Tempo). Sempre renderiza, mesmo com a semana zerada.
 *
 * Spec: handoff-historico/SPEC.md §"Aba 1 — Histórico".
 */
import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ANIM } from '../../lib/animations';
import { GoalRing } from './GoalRing';
import { useBrand } from '../../stores/brandStore';
import { mix } from '../../lib/brandColor';
import {
    getWeekNarrative,
    formatWeekRange,
    formatTon,
    formatDurationHm,
    type WeekGoalData,
} from '../../lib/history';

const EYEBROW = {
    fontSize: 10.5,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
};

export function WeekGoalCard({ data }: { data: WeekGoalData }) {
    const brand = useBrand();
    // Anel mais claro que a cor base (tonalidade clara sobre o fundo dark).
    const ringColor = mix(brand.color, '#FFFFFF', 0.25);
    const narrative = getWeekNarrative({
        goal: data.goal,
        completed: data.completed,
        daysRemainingInWeek: data.daysRemainingInWeek,
        favoriteRemainingWeekday: data.favoriteRemainingWeekday,
    });

    return (
        <Animated.View
            entering={FadeInUp.delay(60).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
            style={{
                marginBottom: 16,
                backgroundColor: '#1A1A1F',
                borderRadius: 24,
                padding: 22,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 4,
            }}
        >
            {/* Header: eyebrow + range de datas */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text
                    accessibilityLabel="Esta semana"
                    style={[EYEBROW, { color: 'rgba(255,255,255,0.5)' }]}
                >
                    Esta semana
                </Text>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>
                    {formatWeekRange(data.weekStart, data.weekEnd)}
                </Text>
            </View>

            {/* Ring + narrativa */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 }}>
                <GoalRing
                    value={data.completed}
                    max={data.goal}
                    fillColor={ringColor}
                    accessibilityLabel={`${data.completed} de ${data.goal} treinos esta semana`}
                >
                    <View style={{ alignItems: 'center' }}>
                        <Text
                            style={{
                                fontSize: 32,
                                fontWeight: '800',
                                letterSpacing: -1.3,
                                color: '#FFFFFF',
                                fontVariant: ['tabular-nums'],
                            }}
                        >
                            {data.completed}
                            <Text style={{ fontSize: 32, fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>
                                /{data.goal}
                            </Text>
                        </Text>
                        <Text style={[EYEBROW, { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1 }]}>
                            Treinos
                        </Text>
                    </View>
                </GoalRing>

                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                        {narrative.heading}
                    </Text>
                    <Text
                        style={{
                            fontSize: 12.5,
                            color: 'rgba(255,255,255,0.55)',
                            lineHeight: 18,
                            marginTop: 4,
                        }}
                    >
                        {narrative.subline}
                    </Text>
                </View>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 18, marginBottom: 16 }} />

            {/* Métricas */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Metric value={formatTon(data.volumeKg, 1)} unit="t" label="Volume" />
                <Metric value={String(data.totalSets)} label="Séries" />
                <Metric value={formatDurationHm(data.totalDurationSec)} label="Tempo" />
            </View>
        </Animated.View>
    );
}

function Metric({ value, unit, label }: { value: string; unit?: string; label: string }) {
    return (
        <View>
            <Text
                style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#FFFFFF',
                    fontVariant: ['tabular-nums'],
                }}
            >
                {value}
                {unit ? (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                        {unit}
                    </Text>
                ) : null}
            </Text>
            <Text style={[EYEBROW, { fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 3 }]}>
                {label}
            </Text>
        </View>
    );
}
