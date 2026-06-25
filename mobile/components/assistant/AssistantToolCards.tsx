/**
 * AssistantToolCards — cards ricos renderizados dentro das respostas do
 * Assistente (os "parts" de ferramenta do design).
 *
 *  - StudentAlertCard: lista de alunos com badge de risco + CTA (Frame 2).
 *  - AdherenceCard: número grande + mini bar chart (Frame 4).
 *  - RevenueCard: receita + stats + aviso de cobranças (Frame 4).
 *
 * Componentes apresentacionais (recebem dados por props). Na Fase 2 serão
 * alimentados pelos resultados reais das ferramentas do agente.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    AlertTriangle,
    MessageCircle,
    TrendingDown,
    TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing, radius } = v2;

export type AlertTone = 'danger' | 'warning' | 'purple';

export interface StudentAlertRow {
    initials: string;
    name: string;
    meta: string;
    badgeLabel: string;
    badgeTone: AlertTone;
}

export interface StudentAlertCardProps {
    title: string;
    countLabel?: string;
    students: StudentAlertRow[];
    ctaLabel?: string;
    onCtaPress?: () => void;
}

export function StudentAlertCard({
    title,
    countLabel,
    students,
    ctaLabel,
    onCtaPress,
}: StudentAlertCardProps) {
    const colors = useV2Colors();
    const tone = (t: AlertTone) =>
        t === 'danger'
            ? { fg: colors.semantic.danger.fg, bg: colors.semantic.danger.bg }
            : t === 'warning'
              ? { fg: colors.semantic.warning.fg, bg: colors.semantic.warning.bg }
              : { fg: colors.purple[600], bg: colors.purple[100] };

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: radius.lg,
                overflow: 'hidden',
            }}
        >
            {/* header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.subtle,
                }}
            >
                <AlertTriangle size={15} color={colors.semantic.warning.default} strokeWidth={1.9} />
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.text.primary }}>
                    {title}
                </Text>
                {countLabel ? (
                    <Text
                        style={{
                            marginLeft: 'auto',
                            fontFamily: 'PlusJakartaSans_500Medium',
                            fontSize: 11,
                            color: colors.text.tertiary,
                        }}
                    >
                        {countLabel}
                    </Text>
                ) : null}
            </View>

            {/* rows */}
            {students.map((s, idx) => {
                const t = tone(s.badgeTone);
                return (
                    <View
                        key={`${s.name}-${idx}`}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing[3],
                            paddingVertical: 13,
                            paddingHorizontal: 16,
                            borderBottomWidth: idx < students.length - 1 ? 1 : 0,
                            borderBottomColor: colors.border.subtle,
                        }}
                    >
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: t.bg,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: t.fg }}>
                                {s.initials}
                            </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}
                                numberOfLines={1}
                            >
                                {s.name}
                            </Text>
                            <Text
                                style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.text.tertiary, marginTop: 1 }}
                                numberOfLines={1}
                            >
                                {s.meta}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: t.bg, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: t.fg }}>
                                {s.badgeLabel}
                            </Text>
                        </View>
                    </View>
                );
            })}

            {/* CTA */}
            {ctaLabel ? (
                <View style={{ padding: 13, borderTopWidth: 1, borderTopColor: colors.border.subtle, backgroundColor: colors.surface.card2 }}>
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onCtaPress?.();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={ctaLabel}
                        style={{ borderRadius: radius.md, overflow: 'hidden' }}
                    >
                        <LinearGradient
                            colors={[colors.purple[500], colors.purple[700]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: spacing[2],
                                paddingVertical: 12,
                            }}
                        >
                            <MessageCircle size={15} color="#FFFFFF" strokeWidth={1.8} />
                            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#FFFFFF' }}>
                                {ctaLabel}
                            </Text>
                        </LinearGradient>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

export interface AdherenceCardProps {
    value: string;
    deltaLabel?: string;
    deltaDirection?: 'up' | 'down';
    bars: number[]; // alturas 0-100
}

export function AdherenceCard({ value, deltaLabel, deltaDirection = 'down', bars }: AdherenceCardProps) {
    const colors = useV2Colors();
    const deltaColor = deltaDirection === 'up' ? colors.semantic.success.fg : colors.semantic.danger.fg;
    const DeltaIcon = deltaDirection === 'up' ? TrendingUp : TrendingDown;

    return (
        <MetricShell label="Aderência · 30 dias">
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], marginBottom: 14 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 34, letterSpacing: -0.7, color: colors.text.primary }}>
                    {value}
                </Text>
                {deltaLabel ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                        <DeltaIcon size={13} color={deltaColor} strokeWidth={2.3} />
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: deltaColor }}>
                            {deltaLabel}
                        </Text>
                    </View>
                ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 60 }}>
                {bars.map((h, i) => {
                    const isLast = i === bars.length - 1;
                    return (
                        <View
                            key={i}
                            style={{
                                flex: 1,
                                height: `${Math.max(8, Math.min(100, h))}%`,
                                borderRadius: 5,
                                backgroundColor: isLast ? colors.purple[600] : colors.purple[200],
                            }}
                        />
                    );
                })}
            </View>
        </MetricShell>
    );
}

export interface RevenueStat {
    value: string;
    label: string;
}

export interface RevenueCardProps {
    value: string;
    deltaLabel?: string;
    deltaDirection?: 'up' | 'down';
    stats: RevenueStat[];
    noteLabel?: string;
    noteActionLabel?: string;
    onNotePress?: () => void;
}

export function RevenueCard({
    value,
    deltaLabel,
    deltaDirection = 'up',
    stats,
    noteLabel,
    noteActionLabel,
    onNotePress,
}: RevenueCardProps) {
    const colors = useV2Colors();
    const deltaColor = deltaDirection === 'up' ? colors.semantic.success.fg : colors.semantic.danger.fg;
    const DeltaIcon = deltaDirection === 'up' ? TrendingUp : TrendingDown;

    return (
        <MetricShell label="Receita · mês">
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], marginBottom: 14 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, letterSpacing: -0.6, color: colors.text.primary }}>
                    {value}
                </Text>
                {deltaLabel ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                        <DeltaIcon size={13} color={deltaColor} strokeWidth={2.3} />
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: deltaColor }}>
                            {deltaLabel}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: noteLabel ? 14 : 0 }}>
                {stats.map((s, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: colors.surface.card2, borderRadius: 12, padding: 11 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text.primary }}>
                            {s.value}
                        </Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: colors.text.tertiary, marginTop: 2 }}>
                            {s.label}
                        </Text>
                    </View>
                ))}
            </View>

            {noteLabel ? (
                <Pressable
                    onPress={() => {
                        Haptics.selectionAsync();
                        onNotePress?.();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${noteLabel}${noteActionLabel ? `. ${noteActionLabel}` : ''}`}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        paddingVertical: 12,
                        paddingHorizontal: 13,
                        backgroundColor: colors.semantic.warning.bg,
                        borderRadius: 12,
                    }}
                >
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.semantic.warning.default }} />
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: colors.semantic.warning.fg, flex: 1 }}>
                        {noteLabel}
                    </Text>
                    {noteActionLabel ? (
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.purple[600] }}>
                            {noteActionLabel} →
                        </Text>
                    ) : null}
                </Pressable>
            ) : null}
        </MetricShell>
    );
}

function MetricShell({ label, children }: { label: string; children: React.ReactNode }) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: radius.lg,
                padding: 17,
            }}
        >
            <Text
                style={{
                    fontFamily: 'PlusJakartaSans_700Bold',
                    fontSize: 11,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: colors.text.tertiary,
                    marginBottom: 11,
                }}
            >
                {label}
            </Text>
            {children}
        </View>
    );
}
