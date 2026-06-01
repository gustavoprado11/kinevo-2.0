import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Award } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

interface PerfectWeekBannerProps {
    completedCount: number;
    /** >1 mostra "Nª seguida". */
    consecutiveCount?: number;
    onShare: () => void;
}

/**
 * Banner persistente na Home quando a semana fecha 100%. Reabre o card
 * compartilhável a qualquer momento da semana. Ref: docs/home-semana-perfeita.html.
 */
export function PerfectWeekBanner({ completedCount, consecutiveCount = 0, onShare }: PerfectWeekBannerProps) {
    const colors = useV2Colors();
    const styles = makeStyles(colors);

    const subtitle = consecutiveCount > 1
        ? `${consecutiveCount}ª semana perfeita seguida`
        : `Todos os ${completedCount} treinos concluídos.`;

    return (
        <View style={[styles.card, { backgroundColor: colors.surface.card, borderColor: 'rgba(16,185,129,0.18)' }]}>
            <View style={styles.icon}>
                <Award size={24} color="#10b981" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>Semana perfeita!</Text>
                <Text style={[styles.sub, { color: colors.text.tertiary }]} numberOfLines={1}>{subtitle}</Text>
            </View>
            <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onShare(); }}
                activeOpacity={0.7}
                style={styles.shareBtn}
                hitSlop={8}
            >
                <Text style={styles.shareText}>Compartilhar</Text>
            </TouchableOpacity>
        </View>
    );
}

function makeStyles(colors: V2Palette) {
    return StyleSheet.create({
        card: {
            flexDirection: 'row', alignItems: 'center', gap: 14,
            borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16,
        },
        icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.10)', alignItems: 'center', justifyContent: 'center' },
        title: { fontSize: 15, fontWeight: '800' },
        sub: { fontSize: 12, marginTop: 2 },
        shareBtn: { backgroundColor: toRgba(colors.purple[600], 0.08), borderWidth: 1, borderColor: toRgba(colors.purple[600], 0.18), borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13 },
        shareText: { color: colors.purple[600], fontSize: 12, fontWeight: '700' },
    });
}
