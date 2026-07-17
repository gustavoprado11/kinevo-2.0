/**
 * KSegmented — segmented control com active pill animado.
 *
 * Container bg neutral[100], items com label + count opcional.
 * Active pill: bg card + shadow xs + texto bold. Reanimated spring no translate X / width.
 *
 * Tokens: shared/tokens/v2.
 */
import React, { useCallback, useState } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing, radius, shadows } = v2;

export interface KSegmentedItem<V extends string = string> {
    value: V;
    label: string;
    count?: number;
}

export interface KSegmentedProps<V extends string = string> {
    value: V;
    onChange: (value: V) => void;
    items: ReadonlyArray<KSegmentedItem<V>>;
    accessibilityLabel?: string;
}

const SPRING = { damping: 22, stiffness: 280, mass: 0.8 };

function nativeShadow(token: typeof shadows.xs) {
    return Platform.OS === 'ios' ? token.ios : token.android;
}

export function KSegmented<V extends string = string>({
    value,
    onChange,
    items,
    accessibilityLabel,
}: KSegmentedProps<V>) {
    const colors = useV2Colors();
    const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

    const x = useSharedValue(0);
    const w = useSharedValue(0);

    const handleLayout = useCallback(
        (val: string) => (e: LayoutChangeEvent) => {
            const { x: lx, width } = e.nativeEvent.layout;
            setLayouts((prev) => {
                const next = { ...prev, [val]: { x: lx, width } };
                if (val === value) {
                    x.value = withSpring(lx, SPRING);
                    w.value = withSpring(width, SPRING);
                }
                return next;
            });
        },
        [value],
    );

    const handlePress = useCallback(
        (val: V) => () => {
            const target = layouts[val];
            if (target) {
                x.value = withSpring(target.x, SPRING);
                w.value = withSpring(target.width, SPRING);
            }
            Haptics.selectionAsync();
            onChange(val);
        },
        [layouts, onChange],
    );

    const pillStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }],
        width: w.value,
    }));

    return (
        <View
            style={[styles.container, { backgroundColor: colors.surface.card2 }]}
            accessibilityRole="tablist"
            accessibilityLabel={accessibilityLabel}
        >
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.pill,
                    { backgroundColor: colors.surface.card },
                    nativeShadow(shadows.xs),
                    pillStyle,
                ]}
            />
            {items.map((item) => {
                const isActive = item.value === value;
                return (
                    <Pressable
                        key={item.value}
                        onLayout={handleLayout(item.value)}
                        onPress={handlePress(item.value)}
                        accessibilityRole="tab"
                        accessibilityLabel={`${item.label}${typeof item.count === 'number' ? ` · ${item.count}` : ''}`}
                        accessibilityState={{ selected: isActive }}
                        style={styles.item}
                        hitSlop={6}
                    >
                        <Text
                            style={{
                                fontFamily: isActive ? 'MonaSans_700Bold' : 'MonaSans_600SemiBold',
                                fontSize: 13,
                                color: isActive ? colors.text.primary : colors.text.tertiary,
                                letterSpacing: -0.005,
                            }}
                        >
                            {item.label}
                            {typeof item.count === 'number' ? (
                                <Text
                                    style={{
                                        color: isActive ? colors.purple[600] : colors.text.quaternary,
                                    }}
                                >
                                    {'  '}
                                    {item.count}
                                </Text>
                            ) : null}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderRadius: radius.md,
        padding: 3,
        alignSelf: 'flex-start',
        position: 'relative',
        minHeight: 36,
    },
    pill: {
        position: 'absolute',
        top: 3,
        bottom: 3,
        left: 0,
        borderRadius: radius.sm,
    },
    item: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        minHeight: 30,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
});
