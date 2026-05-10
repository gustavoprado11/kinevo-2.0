/**
 * BottomNav — Liquid Glass-inspired floating tab bar.
 *
 * Apresentacional. Não integra com Expo Router — quem renderiza decide o onChange.
 *
 * Layout:
 *  - Floating absolute, padding 12pt lateral, 16pt do bottom (offset por safe-area).
 *  - Height 64, radius 22.
 *  - Background: BlurView + overlay glass.
 *  - Estado ativo: pill tinted gradient roxo.
 *  - Badge: contador top-right do ícone.
 *  - Tap: spring scale + haptic light.
 *
 * TODO Fase 3: refinar Android (BlurView tem fallback opaco diferente).
 *
 * Tokens: shared/tokens/v2.
 */
import React, { useCallback } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors, useIsDark } from '../../hooks/useV2Colors';

const { spacing, radius, shadows } = v2;

export interface BottomNavTab<K extends string = string> {
    key: K;
    icon: React.ReactNode;
    label: string;
    badge?: number;
}

export interface BottomNavProps<K extends string = string> {
    tabs: ReadonlyArray<BottomNavTab<K>>;
    activeKey: K;
    onChange: (key: K) => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

const SPRING = { damping: 24, stiffness: 280, mass: 0.8 };

function nativeShadow(token: typeof shadows.glass) {
    return Platform.OS === 'ios' ? token.ios : token.android;
}

export function BottomNav<K extends string = string>({
    tabs,
    activeKey,
    onChange,
    accessibilityLabel,
    style,
}: BottomNavProps<K>) {
    const isDark = useIsDark();
    const overlayBg = isDark ? 'rgba(24,24,27,0.78)' : 'rgba(255,255,255,0.78)';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.06)';

    return (
        <View
            accessibilityRole="tablist"
            accessibilityLabel={accessibilityLabel ?? 'Navegação principal'}
            style={[styles.wrapper, { borderColor }, nativeShadow(shadows.glass), style]}
        >
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blur} />
            <View style={[styles.overlay, { backgroundColor: overlayBg }]} />
            <View style={styles.tabsRow}>
                {tabs.map((tab) => (
                    <NavTabItem
                        key={tab.key}
                        tab={tab}
                        active={tab.key === activeKey}
                        onPress={() => onChange(tab.key)}
                    />
                ))}
            </View>
        </View>
    );
}

function NavTabItem<K extends string>({
    tab,
    active,
    onPress,
}: {
    tab: BottomNavTab<K>;
    active: boolean;
    onPress: () => void;
}) {
    const colors = useV2Colors();
    const scale = useSharedValue(1);
    const activeProgress = useSharedValue(active ? 1 : 0);

    React.useEffect(() => {
        activeProgress.value = withSpring(active ? 1 : 0, SPRING);
    }, [active]);

    const handlePressIn = useCallback(() => {
        scale.value = withTiming(0.94, { duration: 80 });
    }, []);
    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, SPRING);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const tintedStyle = useAnimatedStyle(() => ({
        opacity: activeProgress.value,
    }));

    return (
        <Animated.View style={[styles.tabSlot, containerStyle]}>
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label}${typeof tab.badge === 'number' && tab.badge > 0 ? ` · ${tab.badge} novos` : ''}`}
                accessibilityState={{ selected: active }}
                style={styles.tabPressable}
                hitSlop={4}
            >
                <Animated.View style={[StyleSheet.absoluteFill, styles.tintedWrap, tintedStyle]}>
                    <LinearGradient
                        colors={['rgba(237,233,254,0.6)', 'rgba(245,243,255,0.3)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                <View style={styles.iconWrap}>
                    {React.isValidElement(tab.icon) && typeof tab.icon.type !== 'string'
                        ? React.cloneElement(tab.icon as React.ReactElement<{ color?: string; strokeWidth?: number }>, {
                            color: active ? colors.purple[700] : colors.text.quaternary,
                            strokeWidth: active ? 2.4 : 2,
                        })
                        : tab.icon}
                    {typeof tab.badge === 'number' && tab.badge > 0 ? (
                        <View
                            style={[
                                styles.badge,
                                { borderColor: colors.surface.card },
                            ]}
                        >
                            <Text style={styles.badgeText}>
                                {tab.badge > 99 ? '99+' : tab.badge}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <Text
                    style={{
                        fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                        fontSize: 10,
                        color: active ? colors.purple[700] : colors.text.quaternary,
                        marginTop: 2,
                    }}
                    numberOfLines={1}
                >
                    {tab.label}
                </Text>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        height: 64,
        borderRadius: 22,
        borderWidth: 1,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    blur: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    tabsRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    tabSlot: {
        flex: 1,
        padding: 4,
    },
    tabPressable: {
        flex: 1,
        minHeight: 44,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    tintedWrap: {
        borderRadius: 18,
        overflow: 'hidden',
    },
    iconWrap: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    badgeText: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 9,
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
});

// Avoid unused import warning — radius/spacing intentionally available for future tweaks.
void radius;
void spacing;
