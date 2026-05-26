/**
 * StatRow — linha de métrica do JourneyCard: tile de ícone + label/sub + valor.
 *
 * Cores via useV2Colors (adapta a dark mode). Hairline inferior controlado por
 * `last`. Valor com tabular-nums.
 */
import React from 'react';
import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useV2Colors, useIsDark } from '../../hooks/useV2Colors';
import { useBrand } from '../../stores/brandStore';
import { mix, toRgba } from '../../lib/brandColor';

export interface StatRowProps {
    icon: LucideIcon;
    label: string;
    sub?: string;
    value: string;
    unit?: string;
    last?: boolean;
}

export function StatRow({ icon: Icon, label, sub, value, unit, last = false }: StatRowProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();
    const brand = useBrand();

    const tileBg = isDark ? toRgba(brand.color, 0.15) : toRgba(brand.color, 0.12);
    const iconColor = isDark ? mix(brand.color, '#FFFFFF', 0.35) : brand.color;
    const hairline = isDark ? 'rgba(255,255,255,0.08)' : '#ECECF0';

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: last ? 0 : 1,
                borderBottomColor: hairline,
            }}
        >
            <View
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: tileBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                }}
            >
                <Icon size={16} color={iconColor} strokeWidth={1.8} />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text.primary }}>
                    {label}
                </Text>
                {sub ? (
                    <Text style={{ fontSize: 11.5, color: colors.text.tertiary, marginTop: 1 }}>
                        {sub}
                    </Text>
                ) : null}
            </View>

            <Text
                style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: colors.text.primary,
                    fontVariant: ['tabular-nums'],
                }}
            >
                {value}
                {unit ? (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.tertiary }}>
                        {' '}{unit}
                    </Text>
                ) : null}
            </Text>
        </View>
    );
}
