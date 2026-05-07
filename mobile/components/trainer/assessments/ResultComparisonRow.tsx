import React from 'react';
import { View, Text } from 'react-native';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react-native';
import { colors } from '@/theme';

interface Props {
    label: string;
    /** Already-formatted strings to display side-by-side. */
    previous: string | null;
    current: string;
    /** Signed delta — positive means current > previous. */
    delta?: number | null;
    /** Indicates the metric where lower-is-better (e.g. body fat, RCQ).
     *  Used to color the delta — descent in lower-is-better is green. */
    lower_is_better?: boolean;
    /** Optional units suffix added after the delta number. */
    delta_unit?: string;
}

export function ResultComparisonRow(props: Props) {
    const hasPrev = props.previous !== null;
    const sign =
        props.delta === undefined || props.delta === null
            ? null
            : props.delta > 0
                ? 'up'
                : props.delta < 0
                    ? 'down'
                    : 'flat';

    const goodDirection = props.lower_is_better ? 'down' : 'up';
    const isGood = sign === goodDirection;
    const isFlat = sign === 'flat';

    const Icon = sign === 'up' ? TrendingUp : sign === 'down' ? TrendingDown : Minus;
    const color = isFlat
        ? colors.text.tertiary
        : isGood
            ? colors.success.default
            : colors.error.default;

    return (
        <View
            style={{
                backgroundColor: colors.background.card,
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
            }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                    {props.label}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                    {hasPrev && (
                        <Text style={{ fontSize: 14, color: colors.text.tertiary, textDecorationLine: 'line-through' }}>
                            {props.previous}
                        </Text>
                    )}
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text.primary }}>
                        {props.current}
                    </Text>
                </View>
            </View>
            {hasPrev && sign !== null && (
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: color + '22',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                    }}>
                    <Icon size={14} color={color} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color }}>
                        {props.delta! > 0 ? '+' : ''}
                        {(props.delta ?? 0).toFixed(1)}
                        {props.delta_unit ?? ''}
                    </Text>
                </View>
            )}
            {!hasPrev && (
                <Text style={{ fontSize: 11, color: colors.text.tertiary, fontStyle: 'italic' }}>
                    Primeira
                </Text>
            )}
        </View>
    );
}
