/**
 * KWeekStrip — calendar strip semanal com status dots e streak indicator.
 *
 * Layout: header (range + opcional KStreakBadge) + grid de 7 dias.
 * Cada dia tem label uppercase, número e dot colorido por status.
 *
 * `today` é o destaque visual (gradient roxo + glow).
 * `onDayPress` torna cada dia tocável (com haptic light + scale 0.96).
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { PressableScale } from '../../shared/PressableScale';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';
import { KStreakBadge } from './KStreakBadge';

const { spacing, radius } = v2;

export type WeekDayStatus = 'completed' | 'intense' | 'today' | 'future' | 'rest';

export interface WeekDay {
    date: Date;
    label: string;
    status: WeekDayStatus;
}

export interface KWeekStripProps {
    days: WeekDay[];
    rangeLabel: string;
    streak?: number;
    onDayPress?: (day: WeekDay) => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

function dotConfig(status: WeekDayStatus, isDark: boolean) {
    if (status === 'completed') return { bg: '#10B981', ring: false };
    if (status === 'intense') return { bg: '#F59E0B', ring: true };
    if (status === 'rest') return { bg: isDark ? 'rgba(255,255,255,0.18)' : '#D4D4D8', ring: false };
    if (status === 'future') return { bg: isDark ? 'rgba(255,255,255,0.08)' : '#E4E4E7', ring: false };
    return { bg: 'transparent', ring: false }; // today (sem dot, dia em destaque)
}

export function KWeekStrip({
    days,
    rangeLabel,
    streak,
    onDayPress,
    accessibilityLabel,
    style,
}: KWeekStripProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    const a11y = accessibilityLabel ?? `Semana ${rangeLabel}${streak ? `, streak de ${streak} semanas` : ''}`;

    return (
        <View
            accessibilityRole="summary"
            accessibilityLabel={a11y}
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface.card,
                    borderColor: colors.border.default,
                },
                Platform.OS === 'ios'
                    ? {
                          shadowColor: '#09090B',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 2,
                      }
                    : { elevation: 1 },
                style,
            ]}
        >
            <View style={styles.header}>
                <Text style={[styles.range, { color: colors.text.tertiary }]} numberOfLines={1}>
                    {rangeLabel}
                </Text>
                {typeof streak === 'number' ? (
                    <KStreakBadge count={streak} unit="semanas" size="xs" />
                ) : null}
            </View>

            <View style={styles.grid}>
                {days.map((day, i) => (
                    <DayCell
                        key={i}
                        day={day}
                        isDark={isDark}
                        onPress={onDayPress ? () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                            onDayPress(day);
                        } : undefined}
                    />
                ))}
            </View>
        </View>
    );
}

function DayCell({
    day,
    isDark,
    onPress,
}: {
    day: WeekDay;
    isDark: boolean;
    onPress?: () => void;
}) {
    const colors = useV2Colors();
    const isToday = day.status === 'today';
    const isFuture = day.status === 'future';
    const dot = dotConfig(day.status, isDark);

    const labelColor = isFuture ? colors.text.quaternary : colors.text.tertiary;
    const numColor = isToday
        ? '#FFFFFF'
        : isFuture
          ? colors.text.quaternary
          : colors.text.primary;

    const content = (
        <Animated.View
            entering={isToday ? FadeIn.duration(280) : undefined}
            style={styles.dayInner}
            accessibilityLabel={`${day.label} ${day.date.getDate()}, ${day.status}`}
        >
            <Text style={[styles.dayLabel, { color: labelColor }]} numberOfLines={1}>
                {day.label}
            </Text>

            {isToday ? (
                <LinearGradient
                    colors={[colors.purple[500], colors.purple[600]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.dayNumWrap,
                        styles.dayNumToday,
                        Platform.OS === 'ios'
                            ? {
                                  shadowColor: colors.purple[600],
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.32,
                                  shadowRadius: 8,
                              }
                            : { elevation: 4 },
                    ]}
                >
                    <Text style={[styles.dayNum, { color: numColor }]}>{day.date.getDate()}</Text>
                </LinearGradient>
            ) : (
                <View style={styles.dayNumWrap}>
                    <Text style={[styles.dayNum, { color: numColor }]}>{day.date.getDate()}</Text>
                </View>
            )}

            {isToday ? (
                <View style={styles.dotPlaceholder} />
            ) : (
                <View
                    style={[
                        styles.dot,
                        { backgroundColor: dot.bg },
                        dot.ring && styles.dotRing,
                    ]}
                />
            )}
        </Animated.View>
    );

    if (onPress) {
        return (
            <PressableScale
                onPress={onPress}
                pressScale={0.96}
                style={styles.dayWrap}
                accessibilityRole="button"
            >
                {content}
            </PressableScale>
        );
    }
    return <View style={styles.dayWrap}>{content}</View>;
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radius.lg,
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    range: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayWrap: {
        flex: 1,
    },
    dayInner: {
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    dayLabel: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    dayNumWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayNumToday: {
        // gradient bg via LinearGradient; inherits dayNumWrap dims
    },
    dayNum: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 14,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginTop: 2,
    },
    dotRing: {
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    dotPlaceholder: {
        width: 5,
        height: 5,
        marginTop: 2,
    },
});
