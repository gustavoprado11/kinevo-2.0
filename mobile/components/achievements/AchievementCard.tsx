import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useV2Colors } from '../../hooks/useV2Colors';
import { v2 } from '@kinevo/shared/tokens';

interface AchievementCardProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    locked?: boolean;
    /** Destaque dourado (conquista premium, ex.: semanas perfeitas). */
    gold?: boolean;
    /** Largura fixa (scroll horizontal). Sem valor → flex:1. */
    width?: number;
}

/** Card de conquista reutilizável (Home grid + tela de conquistas). */
export function AchievementCard({ icon, title, subtitle, locked, gold, width }: AchievementCardProps) {
    const colors = useV2Colors();
    const Icon = icon;
    const accent = gold ? '#F59E0B' : colors.brand.primary;

    return (
        <View
            style={[
                {
                    backgroundColor: colors.surface.card,
                    borderRadius: v2.radius.md,
                    borderWidth: 1,
                    borderColor: gold && !locked ? 'rgba(245,158,11,0.35)' : colors.border.default,
                    padding: 12,
                    gap: 6,
                    opacity: locked ? 0.6 : 1,
                },
                width != null ? { width } : { flex: 1 },
            ]}
        >
            <Icon size={22} color={locked ? colors.text.tertiary : accent} strokeWidth={2} />
            <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
                {title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]} numberOfLines={1}>
                {subtitle}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
    subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11 },
});
