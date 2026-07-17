/**
 * V2 Student Showcase — DEV ONLY.
 *
 * Rota dev pra inspecionar os 7 componentes signature do modo aluno (Apple
 * Fitness style) isoladamente. Gate `__DEV__` garante que conteúdo não vaza
 * pra production builds.
 *
 * Acesso: long-press no version text do (tabs)/profile.tsx (modo aluno).
 *
 * Aplicação às telas reais é Fase B/6 — esta route é puro lab.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { v2 } from '@kinevo/shared/tokens';
import {
    KRing,
    KStreakBadge,
    KWeekStrip,
    KPRCard,
    KSetRow,
    KRestTimer,
    KCelebration,
    type WeekDay,
    type KCelebrationType,
} from '../../components/v2/student';

const { colors, spacing, radius } = v2;

const SECTIONS = [
    { id: 'kring', label: 'KRing' },
    { id: 'kstreakbadge', label: 'KStreakBadge' },
    { id: 'kweekstrip', label: 'KWeekStrip' },
    { id: 'kprcard', label: 'KPRCard' },
    { id: 'ksetrow', label: 'KSetRow' },
    { id: 'kresttimer', label: 'KRestTimer' },
    { id: 'kcelebration', label: 'KCelebration' },
] as const;

function today(): Date {
    return new Date();
}
function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

export default function StudentShowcaseScreen() {
    if (!__DEV__) return null;

    const [darkBg, setDarkBg] = useState(false);
    const appVersion = Constants.expoConfig?.version ?? '1.0.0';
    const bg = darkBg ? colors.neutral[950] : colors.surface.canvas;
    const headerColor = darkBg ? '#FFFFFF' : colors.neutral[950];
    const subtitleColor = darkBg ? colors.neutral[400] : colors.neutral[500];

    // KSetRow showcase state (controlled inputs for the 6 variants).
    const [w1, setW1] = useState(0);
    const [r1, setR1] = useState(0);
    const [w2, setW2] = useState(30);
    const [r2, setR2] = useState(8);
    const [w3, setW3] = useState(32);
    const [r3, setR3] = useState(8);
    const [w4, setW4] = useState(35);
    const [r4, setR4] = useState(8);

    // KRestTimer showcase state.
    const [timerKey, setTimerKey] = useState(0);
    const resetTimer = () => setTimerKey((k) => k + 1);

    // KCelebration showcase state.
    const [celebration, setCelebration] = useState<KCelebrationType | null>(null);

    const weekDays3: WeekDay[] = [
        { date: daysAgo(3), label: 'DOM', status: 'completed' },
        { date: daysAgo(2), label: 'SEG', status: 'completed' },
        { date: daysAgo(1), label: 'TER', status: 'intense' },
        { date: today(), label: 'QUA', status: 'today' },
        { date: daysAgo(-1), label: 'QUI', status: 'future' },
        { date: daysAgo(-2), label: 'SEX', status: 'future' },
        { date: daysAgo(-3), label: 'SAB', status: 'rest' },
    ];

    const weekDaysFull: WeekDay[] = weekDays3.map((d) => ({ ...d, status: 'completed' as const }));

    const prDataSteady = [110, 115, 115, 120, 122, 125, 130];
    const prDataRecent = [180, 185, 185, 190, 195, 200];

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: headerColor }]}>Components V2 · Student</Text>
                    <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>
                        DS Showcase · dev only · build {appVersion}
                    </Text>

                    <View style={styles.toggleRow}>
                        <Pressable
                            onPress={() => setDarkBg(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Fundo claro"
                            accessibilityState={{ selected: !darkBg }}
                            style={[styles.toggleBtn, !darkBg && styles.toggleBtnActive]}
                            hitSlop={6}
                        >
                            <Text style={[styles.toggleBtnText, !darkBg && styles.toggleBtnTextActive]}>
                                Light
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setDarkBg(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Fundo escuro"
                            accessibilityState={{ selected: darkBg }}
                            style={[styles.toggleBtn, darkBg && styles.toggleBtnActive]}
                            hitSlop={6}
                        >
                            <Text style={[styles.toggleBtnText, darkBg && styles.toggleBtnTextActive]}>
                                Dark
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.anchorRow}>
                        {SECTIONS.map((s) => (
                            <View key={s.id} style={styles.anchorChip}>
                                <Text style={styles.anchorText}>{s.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── KRing ── */}
                <Section title="KRing" subtitle="Activity ring SVG (single + triple Apple Fitness)" darkBg={darkBg}>
                    <View style={styles.ringRow}>
                        <KRing value={2} max={5} size="sm" color="purple" />
                        <KRing value={25} max={30} size="md" color="purple" label="Treinos" />
                        <KRing value={163} max={200} size="lg" color="green" label="Ton." />
                    </View>
                    <View style={styles.ringRow}>
                        <KRing
                            variant="triple"
                            size="md"
                            value={0}
                            max={0}
                            values={[7, 22, 6]}
                            maxes={[10, 30, 8]}
                            colors={['#FF375F', '#A8FF60', '#5AC8FA']}
                            label="3"
                        />
                        <KRing value={100} max={100} size="md" color="gold" label="100%" />
                    </View>
                </Section>

                {/* ── KStreakBadge ── */}
                <Section title="KStreakBadge" subtitle="Streak counter com flame e optional glow" darkBg={darkBg}>
                    <View style={styles.badgeRow}>
                        <KStreakBadge count={5} unit="dias" size="xs" />
                        <KStreakBadge count={5} unit="dias" size="sm" />
                        <KStreakBadge count={5} unit="dias" size="md" />
                    </View>
                    <View style={styles.badgeRow}>
                        <KStreakBadge count={12} unit="semanas" size="md" />
                        <KStreakBadge count={3} unit="meses" size="md" />
                        <KStreakBadge count={1} unit="dias" size="sm" variant="compact" />
                    </View>
                    <View style={styles.badgeRow}>
                        <KStreakBadge count={24} unit="semanas" size="md" withGlow />
                    </View>
                </Section>

                {/* ── KWeekStrip ── */}
                <Section title="KWeekStrip" subtitle="Calendar strip com status dots + streak" darkBg={darkBg}>
                    <KWeekStrip days={weekDays3} rangeLabel="10 — 16 mai · semana 3" />
                    <View style={{ height: spacing[3] }} />
                    <KWeekStrip days={weekDaysFull} rangeLabel="3 — 9 mai · semana 2" />
                    <View style={{ height: spacing[3] }} />
                    <KWeekStrip days={weekDays3} rangeLabel="10 — 16 mai" streak={12} onDayPress={() => undefined} />
                </Section>

                {/* ── KPRCard ── */}
                <Section title="KPRCard" subtitle="Personal record com progression sparkline" darkBg={darkBg}>
                    <KPRCard
                        exercise="Leg Press 45°"
                        value={200}
                        unit="kg"
                        delta={{ amount: 10, sinceDate: daysAgo(5) }}
                        recent
                        data={prDataRecent}
                    />
                    <View style={{ height: spacing[3] }} />
                    <KPRCard
                        exercise="Levantamento Terra"
                        value={130}
                        unit="kg"
                        delta={{ amount: 5, sinceDate: daysAgo(45) }}
                        data={prDataSteady}
                    />
                    <View style={{ height: spacing[3] }} />
                    <KPRCard exercise="Supino Inclinado" value={70} unit="kg" data={[60, 65, 70]} />
                    <View style={{ height: spacing[3] }} />
                    <KPRCard exercise="Agachamento" value={100} unit="kg" />
                </Section>

                {/* ── KSetRow ── */}
                <Section title="KSetRow" subtitle="Workout set com comparação anterior + check" darkBg={darkBg}>
                    <View style={styles.setRowsHeader}>
                        <Text style={styles.setRowsHeaderCell}>#</Text>
                        <Text style={styles.setRowsHeaderCell}>Ant.</Text>
                        <Text style={styles.setRowsHeaderCell}>kg</Text>
                        <Text style={styles.setRowsHeaderCell}>reps</Text>
                        <Text style={styles.setRowsHeaderCell}> </Text>
                    </View>
                    <KSetRow
                        setNumber={1}
                        previous={{ weight: 30, reps: 8 }}
                        currentWeight={w1}
                        currentReps={r1}
                        onChangeWeight={setW1}
                        onChangeReps={setR1}
                        onComplete={() => undefined}
                    />
                    <KSetRow
                        setNumber={2}
                        previous={{ weight: 30, reps: 8 }}
                        currentWeight={w2}
                        currentReps={r2}
                        onChangeWeight={setW2}
                        onChangeReps={setR2}
                        onComplete={() => undefined}
                    />
                    <KSetRow
                        setNumber={3}
                        previous={{ weight: 30, reps: 8 }}
                        currentWeight={w3}
                        currentReps={r3}
                        onChangeWeight={setW3}
                        onChangeReps={setR3}
                        onComplete={() => undefined}
                        isActive
                    />
                    <KSetRow
                        setNumber={4}
                        previous={{ weight: 30, reps: 8 }}
                        currentWeight={w4}
                        currentReps={r4}
                        onChangeWeight={setW4}
                        onChangeReps={setR4}
                        onComplete={() => undefined}
                        isPRTarget
                    />
                    <KSetRow
                        setNumber={5}
                        previous={{ weight: 30, reps: 8 }}
                        currentWeight={30}
                        currentReps={8}
                        onChangeWeight={() => undefined}
                        onChangeReps={() => undefined}
                        onComplete={() => undefined}
                        isComplete
                    />
                    <KSetRow
                        setNumber={6}
                        previous={{ weight: 30, reps: 8 }}
                        currentWeight={35}
                        currentReps={8}
                        onChangeWeight={() => undefined}
                        onChangeReps={() => undefined}
                        onComplete={() => undefined}
                        isPRTarget
                        isComplete
                    />
                </Section>

                {/* ── KRestTimer ── */}
                <Section title="KRestTimer" subtitle="Rest timer pill inline (countdown)" darkBg={darkBg}>
                    <View style={{ alignItems: 'center', gap: spacing[3] }} key={`timer-${timerKey}`}>
                        <KRestTimer
                            duration={60}
                            onComplete={() => undefined}
                            nextSetLabel="Próximo: série 2 de 3"
                        />
                        <KRestTimer
                            duration={10}
                            onComplete={() => undefined}
                            nextSetLabel="Próximo: série 3 de 3"
                            onSkip={() => undefined}
                        />
                        <Pressable
                            onPress={resetTimer}
                            style={styles.resetBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Resetar timers"
                        >
                            <Text style={styles.resetBtnText}>Reset timers</Text>
                        </Pressable>
                    </View>
                </Section>

                {/* ── KCelebration ── */}
                <Section title="KCelebration" subtitle="Overlay confetti pra PR / workout / streak" darkBg={darkBg}>
                    <View style={{ gap: spacing[2] }}>
                        <CelebrationButton label="🏆 Trigger PR" onPress={() => setCelebration('pr')} />
                        <CelebrationButton
                            label="💪 Trigger workout complete"
                            onPress={() => setCelebration('workout-complete')}
                        />
                        <CelebrationButton
                            label="🔥 Trigger streak milestone (12 semanas)"
                            onPress={() => setCelebration('streak-milestone')}
                        />
                    </View>
                </Section>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: subtitleColor }]}>
                        Próximo: Fase B — aplicar V2 student nas telas (Home, Workout, Logs, Inbox, Profile).
                    </Text>
                </View>
            </ScrollView>

            <KCelebration
                visible={celebration !== null}
                type={celebration ?? 'pr'}
                value={
                    celebration === 'pr'
                        ? '+10kg'
                        : celebration === 'streak-milestone'
                          ? '12 semanas'
                          : '100% aderência'
                }
                onDismiss={() => setCelebration(null)}
                onShare={() => undefined}
            />
        </SafeAreaView>
    );
}

function Section({
    title,
    subtitle,
    children,
    darkBg,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    darkBg: boolean;
}) {
    const titleColor = darkBg ? '#FAFAFA' : colors.neutral[900];
    const subtitleColor = darkBg ? colors.neutral[400] : colors.neutral[500];
    return (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
            <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

function CelebrationButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            style={styles.celebrateBtn}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Text style={styles.celebrateBtnText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing[16] },
    header: {
        paddingHorizontal: spacing[4],
        paddingTop: spacing[4],
        paddingBottom: spacing[5],
    },
    headerTitle: {
        fontFamily: 'MonaSans_800ExtraBold',
        fontSize: 26,
        letterSpacing: -0.8,
    },
    headerSubtitle: {
        fontFamily: 'MonaSans_500Medium',
        fontSize: 13,
        marginTop: 2,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[3],
    },
    toggleBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    toggleBtnActive: { backgroundColor: colors.purple[600] },
    toggleBtnText: {
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 12,
        color: colors.neutral[700],
    },
    toggleBtnTextActive: { color: '#FFFFFF' },
    anchorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: spacing[3],
    },
    anchorChip: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(124,58,237,0.08)',
    },
    anchorText: {
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 10,
        color: colors.purple[700],
        letterSpacing: 0.4,
    },
    section: {
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[5],
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    sectionTitle: {
        fontFamily: 'MonaSans_800ExtraBold',
        fontSize: 20,
        letterSpacing: -0.4,
    },
    sectionSubtitle: {
        fontFamily: 'MonaSans_500Medium',
        fontSize: 12,
        marginTop: 2,
    },
    sectionBody: { marginTop: spacing[4] },
    ringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[5],
        marginBottom: spacing[3],
        flexWrap: 'wrap',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[2],
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    setRowsHeader: {
        flexDirection: 'row',
        paddingBottom: 6,
        paddingHorizontal: 4,
    },
    setRowsHeaderCell: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'MonaSans_700Bold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.neutral[500],
    },
    resetBtn: {
        marginTop: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: colors.neutral[200],
    },
    resetBtnText: {
        fontFamily: 'MonaSans_700Bold',
        fontSize: 12,
        color: colors.neutral[800],
    },
    celebrateBtn: {
        paddingVertical: 14,
        paddingHorizontal: spacing[4],
        borderRadius: radius.md,
        backgroundColor: colors.purple[600],
        alignItems: 'center',
    },
    celebrateBtnText: {
        fontFamily: 'MonaSans_700Bold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    footer: {
        paddingHorizontal: spacing[4],
        paddingTop: spacing[6],
    },
    footerText: {
        fontFamily: 'MonaSans_500Medium',
        fontSize: 12,
        textAlign: 'center',
    },
});
