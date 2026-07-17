/**
 * KSetRow — linha de set durante execução de treino.
 *
 * Grid 5 colunas: # / Ant. (weight×reps) / kg input / reps input / check.
 *
 * Estados:
 *   - idle: inputs vazios, check outline
 *   - active: border purple sutil ao redor da row
 *   - isPRTarget: glow gold nos inputs (prestes a bater PR)
 *   - isComplete: bg success/0.06 + check filled
 *   - PR target + complete: gradient gold celebratório
 *
 * Tap no check: scale 0.94 + haptic medium (strong se PR).
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React, { useEffect } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { PressableScale } from '../../shared/PressableScale';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';

const { spacing, radius } = v2;

export interface KSetRowProps {
    setNumber: number;
    previous?: { weight: number; reps: number };
    currentWeight: number;
    currentReps: number;
    onChangeWeight: (w: number) => void;
    onChangeReps: (r: number) => void;
    onComplete: () => void;
    isPRTarget?: boolean;
    isComplete?: boolean;
    isActive?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

function parseNumeric(text: string): number {
    const cleaned = text.replace(',', '.').replace(/[^\d.]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}

function displayValue(n: number): string {
    if (!Number.isFinite(n) || n === 0) return '';
    // Mostra inteiros sem .0, mantém decimal quando há.
    return n % 1 === 0 ? String(n) : String(n);
}

export function KSetRow({
    setNumber,
    previous,
    currentWeight,
    currentReps,
    onChangeWeight,
    onChangeReps,
    onComplete,
    isPRTarget,
    isComplete,
    isActive,
    disabled,
    accessibilityLabel,
    style,
}: KSetRowProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    const checkScale = useSharedValue(1);
    const ringScale = useSharedValue(0);
    const ringOpacity = useSharedValue(0);

    useEffect(() => {
        if (isComplete) {
            ringScale.value = 0;
            ringOpacity.value = 0.6;
            ringScale.value = withTiming(1.6, { duration: 380 });
            ringOpacity.value = withTiming(0, { duration: 420 });
        }
    }, [isComplete]);

    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: ringOpacity.value,
    }));

    const handleCheckPress = () => {
        if (disabled) return;
        checkScale.value = withSpring(0.94, { damping: 12, stiffness: 280 }, () => {
            checkScale.value = withSpring(1, { damping: 14, stiffness: 280 });
        });
        if (isPRTarget) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        }
        onComplete();
    };

    const checkAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));

    const rowBg = isComplete
        ? isPRTarget
            ? 'rgba(245,158,11,0.10)'
            : 'rgba(16,185,129,0.06)'
        : 'transparent';

    const rowBorder = isActive
        ? colors.purple[300]
        : isComplete
          ? isPRTarget
              ? 'rgba(245,158,11,0.32)'
              : 'rgba(16,185,129,0.28)'
          : 'transparent';

    const inputBg = isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[100];
    const inputBorder = isPRTarget
        ? '#F59E0B'
        : isActive
          ? colors.purple[300]
          : 'transparent';

    const inputGlow = isPRTarget
        ? Platform.OS === 'ios'
            ? {
                  shadowColor: '#F59E0B',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.45,
                  shadowRadius: 6,
              }
            : { elevation: 2 }
        : null;

    const setNumBg = isComplete
        ? '#D1FAE5'
        : isDark
          ? 'rgba(255,255,255,0.08)'
          : colors.neutral[100];

    const setNumColor = isComplete
        ? '#047857'
        : colors.text.tertiary;

    const a11y = accessibilityLabel ?? `Set ${setNumber}${isComplete ? ', completo' : ''}${isPRTarget ? ', PR target' : ''}`;

    return (
        <View
            accessibilityRole="summary"
            accessibilityLabel={a11y}
            style={[
                styles.row,
                {
                    backgroundColor: rowBg,
                    borderColor: rowBorder,
                },
                style,
            ]}
        >
            {/* # */}
            <View style={[styles.setNumCell]}>
                <View style={[styles.setNumCircle, { backgroundColor: setNumBg }]}>
                    <Text style={[styles.setNumText, { color: setNumColor }]}>{setNumber}</Text>
                </View>
            </View>

            {/* Ant. */}
            <View style={styles.prevCell}>
                {previous ? (
                    <Text style={[styles.prevText, { color: colors.text.tertiary }]}>
                        {previous.weight}×{previous.reps}
                    </Text>
                ) : (
                    <Text style={[styles.prevText, { color: colors.text.quaternary }]}>—</Text>
                )}
            </View>

            {/* kg */}
            <View style={[styles.inputCell, inputGlow]}>
                <TextInput
                    value={displayValue(currentWeight)}
                    onChangeText={(t) => onChangeWeight(parseNumeric(t))}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={colors.text.quaternary}
                    editable={!disabled && !isComplete}
                    style={[
                        styles.input,
                        {
                            backgroundColor: inputBg,
                            borderColor: inputBorder,
                            color: colors.text.primary,
                        },
                    ]}
                    accessibilityLabel={`Peso do set ${setNumber}`}
                />
            </View>

            {/* reps */}
            <View style={[styles.inputCell, inputGlow]}>
                <TextInput
                    value={displayValue(currentReps)}
                    onChangeText={(t) => onChangeReps(parseNumeric(t))}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={colors.text.quaternary}
                    editable={!disabled && !isComplete}
                    style={[
                        styles.input,
                        {
                            backgroundColor: inputBg,
                            borderColor: inputBorder,
                            color: colors.text.primary,
                        },
                    ]}
                    accessibilityLabel={`Reps do set ${setNumber}`}
                />
            </View>

            {/* check */}
            <View style={styles.checkCell}>
                <PressableScale
                    onPress={handleCheckPress}
                    pressScale={1}
                    accessibilityRole="button"
                    accessibilityLabel={isComplete ? 'Marcar set incompleto' : 'Marcar set completo'}
                    accessibilityState={{ checked: !!isComplete }}
                    disabled={disabled}
                    style={styles.checkPressArea}
                >
                    <Animated.View style={[styles.checkOuter, checkAnimStyle]}>
                        {isComplete ? (
                            <LinearGradient
                                colors={isPRTarget ? ['#F59E0B', '#D97706'] : ['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.checkCircleFilled}
                            >
                                <Check size={16} color="#FFFFFF" strokeWidth={3} />
                            </LinearGradient>
                        ) : (
                            <View style={[styles.checkCircleOutline, { borderColor: colors.neutral[300] }]} />
                        )}
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.checkRing,
                                { borderColor: isPRTarget ? '#F59E0B' : '#10B981' },
                                ringStyle,
                            ]}
                        />
                    </Animated.View>
                </PressableScale>
            </View>
        </View>
    );
}

const SET_NUM_W = 28;
const CHECK_W = 30;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderRadius: radius.sm,
        marginVertical: 2,
        gap: 6,
    },
    setNumCell: {
        width: SET_NUM_W,
        alignItems: 'center',
    },
    setNumCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setNumText: {
        fontFamily: 'MonaSans_700Bold',
        fontSize: 12,
    },
    prevCell: {
        flex: 1,
        alignItems: 'center',
    },
    prevText: {
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 12,
    },
    inputCell: {
        flex: 1,
        paddingHorizontal: 2,
    },
    input: {
        height: 36,
        borderRadius: radius.sm,
        borderWidth: 1,
        textAlign: 'center',
        fontFamily: 'MonaSans_700Bold',
        fontSize: 14,
        paddingHorizontal: 4,
    },
    checkCell: {
        width: CHECK_W,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkPressArea: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkOuter: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleOutline: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1.5,
    },
    checkCircleFilled: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkRing: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
    },
});
