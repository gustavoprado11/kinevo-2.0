// T6 — Semana Perfeita. Card editorial light da família de share cards (T1–T5):
// off-white, hero "5/5" preto, eyebrow violeta, chip dourado-cream (DNA do T2),
// lista hairline e ShareBrandFooter padrão. Reusa as primitivas _shared/.
// Spec: handoff-semana-perfeita/SPEC.md → Opção A Editorial.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Star } from 'lucide-react-native';
import { ShareTopRow } from './_shared/ShareTopRow';
import { ShareGrain } from './_shared/ShareGrain';
import { ShareAccentStripe } from './_shared/ShareAccentStripe';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { SHARE_TOKENS, useShareTokens, FONT, CARD_W, CARD_H } from './_shared/tokens';

export interface PerfectWeekWorkout {
    name: string;
    /** Detalhe à direita: duração já formatada ("45 min"). Null → exibe "—". */
    detail?: string | null;
}

export interface PerfectWeekCardProps {
    completedCount: number;
    expectedCount: number;
    programName?: string | null;
    programWeek?: number | null;
    /** Semanas perfeitas consecutivas (>=1 mostra o chip). */
    consecutiveCount?: number;
    workouts: PerfectWeekWorkout[];
    studentName: string;
    /** Ex.: "17–23 mai". */
    weekRangeLabel: string;
    coach?: { name?: string | null; avatar_url?: string | null; instagram_handle?: string | null } | null;
}

const CHECK_GREEN = '#16A34A';
const MAX_ROWS = 5;

/** Cópia condicional do chip de streak. Marcos (5,10,25,50,100) ganham sufixo. */
function streakLabel(n: number): string | null {
    if (n < 1) return null;
    if (n === 1) return 'Primeira semana perfeita';
    if (n === 5 || n === 10 || n === 25 || n === 50 || n === 100) {
        return `${n} semanas perfeitas seguidas · marco`;
    }
    return `${n}ª semana perfeita seguida`;
}

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
    const bt = useShareTokens();
    const streak = streakLabel(consecutiveCount);
    const shown = workouts.slice(0, MAX_ROWS);
    const extra = workouts.length - shown.length;
    const totalRows = shown.length + (extra > 0 ? 1 : 0);

    // Footer usa o trainer; sem trainer, cai pro aluno (sem @handle).
    const footerCoach = coach?.name
        ? { name: coach.name, avatar_url: coach.avatar_url ?? null, instagram_handle: coach.instagram_handle ?? null }
        : { name: studentName, avatar_url: null, instagram_handle: null };

    const a11y = `Card de Semana Perfeita. ${completedCount} de ${expectedCount} treinos${programName ? ` do ${programName}` : ''}${programWeek ? `, semana ${programWeek}` : ''}.${streak ? ` ${streak}.` : ''}`;

    return (
        <View style={styles.container} accessibilityRole="image" accessibilityLabel={a11y}>
            {/* Wash violeta radial no topo */}
            <LinearGradient
                colors={[SHARE_TOKENS.tintT3, 'rgba(238,234,252,0)']}
                locations={[0, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.55 }}
                style={styles.wash}
            />
            <ShareGrain opacity={0.05} />
            <ShareAccentStripe />

            <View style={styles.inner}>
                <ShareTopRow label="Semana concluída" date={weekRangeLabel} />

                {/* Hero */}
                <View style={styles.hero}>
                    <Text style={[styles.eyebrow, { color: bt.brandText }]}>SEMANA PERFEITA</Text>
                    <View style={styles.heroRow}>
                        <Text style={styles.heroNum}>{completedCount}</Text>
                        <Text style={styles.heroSlash}>/</Text>
                        <Text style={styles.heroNum}>{expectedCount}</Text>
                    </View>
                    <Text style={styles.caption}>treinos concluídos</Text>

                    {programName ? (
                        <Text style={styles.context} numberOfLines={1}>
                            <Text style={styles.contextStrong}>{programName}</Text>
                            {programWeek ? <Text style={styles.contextSoft}>{`  ·  Semana ${programWeek}`}</Text> : null}
                        </Text>
                    ) : null}

                    {streak ? (
                        <View style={styles.chip}>
                            <Star size={11} color={SHARE_TOKENS.goldText} strokeWidth={2.4} />
                            <Text style={styles.chipText}>{streak}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Lista de treinos */}
                <View style={styles.list}>
                    {shown.map((w, i) => {
                        const isLast = i === totalRows - 1;
                        return (
                            <View key={i} style={[styles.row, isLast && styles.rowLast]}>
                                <View style={styles.check}>
                                    <Check size={9} color="#FFFFFF" strokeWidth={3} />
                                </View>
                                <Text style={styles.rowName} numberOfLines={1} ellipsizeMode="tail">
                                    {w.name}
                                </Text>
                                {w.detail ? (
                                    <Text style={styles.rowDuration}>{w.detail}</Text>
                                ) : (
                                    <Text style={[styles.rowDuration, styles.rowDurationDim]}>—</Text>
                                )}
                            </View>
                        );
                    })}
                    {extra > 0 ? (
                        <View style={[styles.row, styles.rowLast]}>
                            <Text style={styles.rowMore}>{`+ ${extra} mais`}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={{ flex: 1 }} />

                <ShareBrandFooter coach={footerCoach} borderColor="rgba(0,0,0,0.08)" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, backgroundColor: SHARE_TOKENS.canvas, overflow: 'hidden' },
    wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
    inner: { flex: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24 },

    hero: { marginTop: 38 },
    eyebrow: {
        fontFamily: FONT.bold, fontSize: 10.5, color: SHARE_TOKENS.brandText,
        letterSpacing: 1.65, textTransform: 'uppercase',
    },
    heroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
    heroNum: {
        fontFamily: FONT.extrabold, fontSize: 108, color: SHARE_TOKENS.textPrimary,
        letterSpacing: -5.5, lineHeight: 99, fontVariant: ['tabular-nums'],
    },
    heroSlash: {
        fontFamily: FONT.semibold, fontSize: 108, color: SHARE_TOKENS.textSecondary,
        letterSpacing: -3, lineHeight: 99,
    },
    caption: {
        fontFamily: FONT.semibold, fontSize: 15, color: '#3A3A3C',
        letterSpacing: -0.2, marginTop: 6,
    },
    context: { marginTop: 18, fontSize: 13, lineHeight: 19 },
    contextStrong: { fontFamily: FONT.semibold, fontSize: 13, color: SHARE_TOKENS.textPrimary },
    contextSoft: { fontFamily: FONT.medium, fontSize: 13, color: SHARE_TOKENS.textSecondary },

    chip: {
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 14, backgroundColor: '#FFFFFF',
        borderWidth: 0.5, borderColor: SHARE_TOKENS.goldBorder,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
        shadowColor: SHARE_TOKENS.goldText, shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    },
    chipText: {
        fontFamily: FONT.bold, fontSize: 10.5, color: SHARE_TOKENS.goldText, letterSpacing: 0.4,
    },

    list: { marginTop: 22 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 9, borderTopWidth: 0.5, borderTopColor: SHARE_TOKENS.hairline,
    },
    rowLast: { borderBottomWidth: 0.5, borderBottomColor: SHARE_TOKENS.hairline },
    check: {
        width: 16, height: 16, borderRadius: 8, backgroundColor: CHECK_GREEN,
        alignItems: 'center', justifyContent: 'center',
    },
    rowName: {
        flex: 1, fontFamily: FONT.semibold, fontSize: 13,
        color: SHARE_TOKENS.textPrimary, letterSpacing: -0.2,
    },
    rowDuration: {
        fontFamily: FONT.semibold, fontSize: 12.5, color: SHARE_TOKENS.textSecondary,
        fontVariant: ['tabular-nums'],
    },
    rowDurationDim: { color: SHARE_TOKENS.textTertiary },
    rowMore: { fontFamily: FONT.medium, fontSize: 12, color: SHARE_TOKENS.textSecondary, marginLeft: 26 },
});
