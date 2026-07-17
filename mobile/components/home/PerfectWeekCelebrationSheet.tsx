import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerfectWeekCardProps } from '../workout/sharing/PerfectWeekTemplate';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

interface PerfectWeekCelebrationSheetProps {
    visible: boolean;
    card: PerfectWeekCardProps;
    onShare: () => void;
    onClose: () => void;
}

/**
 * Momento in-app quando a semana fecha 100% — sobe ao cair na Home após o
 * treino que fechou a semana. Ref: docs/home-semana-perfeita.html (seção 2).
 *
 * Folha enxuta (medalha + stats); o card completo aparece ao tocar Compartilhar.
 * Fade nativo do Modal (sem Reanimated entering — animação sóbria).
 */
export function PerfectWeekCelebrationSheet({ visible, card, onShare, onClose }: PerfectWeekCelebrationSheetProps) {
    const colors = useV2Colors();
    const styles = makeStyles(colors);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [visible]);

    const stats: { value: string; label: string }[] = [
        { value: `${card.completedCount}/${card.expectedCount}`, label: 'Treinos' },
        { value: '100%', label: 'Aderência' },
    ];
    if (card.consecutiveCount && card.consecutiveCount > 1) {
        stats.push({ value: `${card.consecutiveCount}ª`, label: 'Seguida' });
    }

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.container}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <View style={[styles.sheet, { backgroundColor: colors.surface.card, paddingBottom: insets.bottom + 18 }]}>
                    <View style={styles.grabber} />

                    <LinearGradient
                        colors={['#FDE68A', '#F59E0B']}
                        start={{ x: 0.3, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={styles.medal}
                    >
                        <Award size={28} color="#FFFFFF" strokeWidth={2.2} />
                    </LinearGradient>

                    <Text style={[styles.title, { color: colors.text.primary }]}>Semana perfeita</Text>
                    <Text style={[styles.sub, { color: colors.text.secondary }]}>
                        Você fechou os {card.completedCount} treinos da semana.
                    </Text>

                    {/* Faixa de stats */}
                    <View style={[styles.statsRow, { borderColor: colors.border.default }]}>
                        {stats.map((s, i) => (
                            <React.Fragment key={s.label}>
                                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border.default }]} />}
                                <View style={styles.stat}>
                                    <Text style={[styles.statValue, { color: colors.text.primary }]}>{s.value}</Text>
                                    <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>{s.label}</Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>

                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onShare(); }}
                        activeOpacity={0.85}
                        style={styles.primary}
                    >
                        <Share2 size={17} color="#fff" strokeWidth={2.2} />
                        <Text style={styles.primaryText}>Compartilhar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.ghost} hitSlop={8}>
                        <Text style={[styles.ghostText, { color: colors.text.tertiary }]}>Agora não</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function makeStyles(colors: V2Palette) {
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(9,9,15,0.55)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, alignItems: 'center' },
    grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,120,130,0.35)', marginBottom: 18 },
    medal: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'MonaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.4, marginTop: 14 },
    sub: { fontFamily: 'MonaSans_500Medium', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
    statsRow: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingVertical: 16, marginTop: 22,
    },
    stat: { flex: 1, alignItems: 'center' },
    divider: { width: StyleSheet.hairlineWidth, height: 34 },
    statValue: { fontFamily: 'MonaSans_800ExtraBold', fontSize: 20, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: 'MonaSans_600SemiBold', fontSize: 10, marginTop: 4, letterSpacing: 0.4, textTransform: 'uppercase' },
    primary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.purple[600], borderRadius: 15, paddingVertical: 15, alignSelf: 'stretch', marginTop: 24,
    },
    primaryText: { fontFamily: 'MonaSans_800ExtraBold', fontSize: 15, color: '#fff' },
    ghost: { paddingVertical: 12, marginTop: 2 },
    ghostText: { fontFamily: 'MonaSans_700Bold', fontSize: 14 },
    });
}
