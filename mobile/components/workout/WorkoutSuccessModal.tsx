import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import { X, Share2 } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { ANIM } from '../../lib/animations';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShareWorkoutModal } from './ShareWorkoutModal';
import { WorkoutShareableCard } from './WorkoutShareableCard';

interface WorkoutSuccessModalProps {
    visible: boolean;
    onClose: () => void;
    data?: {
        workoutName: string;
        duration: string;
        exerciseCount: number;
        volume: number;
        date: string;
        studentName: string;
        coach: { name: string; avatar_url: string | null } | null;
        completedSets?: number;
        totalSets?: number;
        rpe?: number;
    };
}

const CARD_ASPECT_RATIO = 568 / 320; // Original card proportions

function formatRelativeDate(dateStr: string): string {
    const today = new Date().toLocaleDateString('pt-BR');
    if (dateStr === today) return 'Hoje';
    return dateStr;
}

export function WorkoutSuccessModal({ visible, onClose, data }: WorkoutSuccessModalProps) {
    const { width: screenWidth } = useWindowDimensions();
    const CARD_PREVIEW_WIDTH = screenWidth * 0.7;

    const scale = useSharedValue(0);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) {
            scale.value = withSequence(
                withTiming(1.02, { duration: 200, easing: Easing.out(Easing.cubic) }),
                withTiming(1, ANIM.timing.fast)
            );
        } else {
            scale.value = 0;
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handleOpenShare = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShareModalVisible(true);
    };

    if (!data) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ width: 32 }} />
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Treino concluído</Text>
                        <Text style={styles.headerSubtitle}>
                            {data.workoutName} {'\u00B7'} {formatRelativeDate(data.date)}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={12}
                        style={styles.closeButton}
                        activeOpacity={0.7}
                    >
                        <X size={18} color="#8e8e93" strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>

                {/* Card Preview */}
                <Animated.View style={[styles.previewContainer, animatedStyle]}>
                    <View
                        style={{
                            width: CARD_PREVIEW_WIDTH,
                            height: CARD_PREVIEW_WIDTH * CARD_ASPECT_RATIO,
                            borderRadius: 20,
                            overflow: 'hidden',
                            shadowColor: '#7c3aed',
                            shadowOffset: { width: 0, height: 12 },
                            shadowOpacity: 0.2,
                            shadowRadius: 32,
                            elevation: 16,
                        }}
                    >
                        <WorkoutShareableCard {...data} />
                    </View>
                </Animated.View>

                {/* Actions */}
                <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
                    <TouchableOpacity
                        onPress={handleOpenShare}
                        style={styles.shareButton}
                        activeOpacity={0.8}
                    >
                        <Share2 size={18} color="#fff" strokeWidth={2.5} />
                        <Text style={styles.shareButtonText}>Compartilhar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.skipButton}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Voltar ao início</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ShareWorkoutModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                data={data}
                sessionId={(data as any).sessionId}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#8e8e93',
        marginTop: 2,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actions: {
        paddingHorizontal: 24,
        gap: 12,
    },
    shareButton: {
        height: 52,
        borderRadius: 14,
        backgroundColor: '#7c3aed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    shareButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    skipButton: {
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#8e8e93',
    },
});
