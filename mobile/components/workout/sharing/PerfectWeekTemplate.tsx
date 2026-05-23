// Semana Perfeita — card compartilhável (variação B do mock: "100%" herói).
// Card DARK (gradiente índigo) — celebração, diverge da família light dos
// outros templates de propósito. Ref: docs/home-semana-perfeita.html.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Star } from 'lucide-react-native';
import { KMark } from './_shared/KMark';
import { FONT, CARD_W, CARD_H } from './_shared/tokens';

export interface PerfectWeekWorkout {
    name: string;
    /** Detalhe à direita: duração ("45min") ou dia ("seg"). Opcional. */
    detail?: string | null;
}

export interface PerfectWeekCardProps {
    completedCount: number;
    expectedCount: number;
    programName?: string | null;
    programWeek?: number | null;
    /** "Nª semana perfeita seguida" (>1 mostra a pílula). */
    consecutiveCount?: number;
    workouts: PerfectWeekWorkout[];
    studentName: string;
    /** Ex.: "17–23 de maio". */
    weekRangeLabel: string;
    coach?: { name?: string | null; avatar_url?: string | null } | null;
}

const CONFETTI = [
    { top: 50, left: 40, bg: '#FCD34D', rot: '20deg' },
    { top: 70, left: 250, bg: '#A78BFA', rot: '-15deg' },
    { top: 110, left: 150, bg: '#F472B6', rot: '40deg' },
    { top: 36, left: 120, bg: '#34D399', rot: '10deg' },
    { top: 150, left: 280, bg: '#FFFFFF', rot: '-30deg' },
    { top: 190, left: 30, bg: '#FCD34D', rot: '25deg' },
];

export const PerfectWeekTemplate = ({
    completedCount,
    expectedCount,
    programName,
    programWeek,
    consecutiveCount = 0,
    workouts,
    studentName,
    weekRangeLabel,
    coach,
}: PerfectWeekCardProps) => {
    const subtitle = [
        `${completedCount} de ${expectedCount} treinos`,
        programName,
        programWeek ? `Semana ${programWeek}` : null,
    ].filter(Boolean).join(' · ');

    const rows = workouts.slice(0, 6);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#312E81', '#1E1B4B', '#0F172A']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
            />
            {/* Glows */}
            <View style={styles.glowA} />
            <View style={styles.glowB} />
            {/* Confetti */}
            {CONFETTI.map((c, i) => (
                <View
                    key={i}
                    style={{
                        position: 'absolute', top: c.top, left: c.left,
                        width: 8, height: 8, borderRadius: 2, opacity: 0.9,
                        backgroundColor: c.bg, transform: [{ rotate: c.rot }],
                    }}
                />
            ))}

            <View style={styles.inner}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>✦ Semana perfeita ✦</Text>
                </View>

                {/* Hero 100% */}
                <View style={{ alignItems: 'center', marginTop: 28 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Text style={styles.hero}>100</Text>
                        <Text style={styles.heroPct}>%</Text>
                    </View>
                    <Text style={styles.heroLabel}>Semana perfeita</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>

                {/* Pílula "Nª seguida" */}
                {consecutiveCount > 1 && (
                    <View style={styles.pill}>
                        <Star size={13} color="#FBCFE8" strokeWidth={2} />
                        <Text style={styles.pillText}>{consecutiveCount}ª semana perfeita seguida</Text>
                    </View>
                )}

                {/* Checklist */}
                <View style={{ marginTop: 22, gap: 7 }}>
                    {rows.map((w, i) => (
                        <View key={i} style={styles.crow}>
                            <View style={styles.ck}>
                                <Check size={11} color="#22C55E" strokeWidth={3} />
                            </View>
                            <Text style={styles.crowName} numberOfLines={1}>{w.name}</Text>
                            {w.detail ? <Text style={styles.crowDetail}>{w.detail}</Text> : null}
                        </View>
                    ))}
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer (dark) */}
                <View style={styles.footer}>
                    <View style={styles.footL}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarInitial}>
                                {(studentName || 'K').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={{ flexShrink: 1 }}>
                            <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
                            <Text style={styles.weekRange} numberOfLines={1}>{weekRangeLabel}</Text>
                        </View>
                    </View>
                    <View style={styles.brand}>
                        <KMark size={16} />
                        <Text style={styles.brandText}>Kinevo</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, overflow: 'hidden', backgroundColor: '#1E1B4B' },
    glowA: { position: 'absolute', top: -120, left: -120, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(124,58,237,0.22)' },
    glowB: { position: 'absolute', bottom: -80, right: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(252,211,77,0.10)' },
    inner: { flex: 1, paddingHorizontal: 28, paddingTop: 34, paddingBottom: 24 },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(252,211,77,0.14)',
        borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(252,211,77,0.4)',
        borderRadius: 8, paddingVertical: 6, paddingHorizontal: 11,
    },
    badgeText: { fontFamily: FONT.extrabold, fontSize: 10, color: '#FCD34D', letterSpacing: 2, textTransform: 'uppercase' },
    hero: { fontFamily: FONT.extrabold, fontSize: 96, lineHeight: 96, color: '#FDE68A', letterSpacing: -5 },
    heroPct: { fontFamily: FONT.extrabold, fontSize: 46, lineHeight: 60, color: '#FDE68A', letterSpacing: -2 },
    heroLabel: { fontFamily: FONT.extrabold, fontSize: 22, color: '#F8FAFC', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 },
    subtitle: { fontFamily: FONT.semibold, fontSize: 13, color: '#C4B5FD', marginTop: 6, textAlign: 'center' },
    pill: {
        alignSelf: 'center', marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(244,114,182,0.12)', borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(244,114,182,0.25)', borderRadius: 99, paddingVertical: 7, paddingHorizontal: 12,
    },
    pillText: { fontFamily: FONT.bold, fontSize: 12, color: '#FBCFE8' },
    crow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    ck: { width: 18, height: 18, borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' },
    crowName: { fontFamily: FONT.semibold, fontSize: 12.5, color: '#E2E8F0', flexShrink: 1 },
    crowDetail: { fontFamily: FONT.medium, fontSize: 11, color: '#64748B', marginLeft: 'auto' },
    footer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
    },
    footL: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
    avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#475569', alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontFamily: FONT.bold, fontSize: 13, color: '#E2E8F0' },
    studentName: { fontFamily: FONT.bold, fontSize: 12, color: '#F1F5F9' },
    weekRange: { fontFamily: FONT.medium, fontSize: 10, color: '#94A3B8', marginTop: 1 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    brandText: { fontFamily: FONT.extrabold, fontSize: 13, color: '#FFFFFF' },
});
