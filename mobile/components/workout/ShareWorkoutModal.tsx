import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View, Text, Modal, Pressable, Platform, Alert, Dimensions, StyleSheet,
} from 'react-native';
import {
    Share2, X, Camera, Image as ImageIcon, Trophy, FileText, LayoutTemplate,
} from 'lucide-react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence,
    interpolate, Extrapolation, Easing,
} from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStats } from '../../hooks/useSessionStats';

// Templates
import { PhotoOverlayTemplate } from './sharing/PhotoOverlayTemplate';
import { MaxLoadsTemplate } from './sharing/MaxLoadsTemplate';
import { FullWorkoutTemplate } from './sharing/FullWorkoutTemplate';
import { SummaryTemplate } from './sharing/SummaryTemplate';
import { PRTemplate } from './sharing/PRTemplate';
import { ShareableCardProps } from './sharing/types';

interface ShareWorkoutModalProps {
    visible: boolean;
    onClose: () => void;
    data?: ShareableCardProps;
    sessionId?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Preview — controlled proportion, never dominates.
const CARD_W = 320;
const CARD_H = 568;
const MAX_PREVIEW_H = SCREEN_HEIGHT * 0.48; // cap at ~48vh
const IDEAL_SCALE = (SCREEN_WIDTH - 64) / CARD_W;  // comfortable side margins
const PREVIEW_SCALE = Math.min(IDEAL_SCALE, MAX_PREVIEW_H / CARD_H);
const SCALED_H = CARD_H * PREVIEW_SCALE;

type TemplateType = 'photo' | 'highlights' | 'full_workout' | 'summary' | 'pr';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Opacity Press Button (iOS Native pattern — no bouncy scale) ──
function OpacityButton({
    onPress,
    children,
    style,
}: {
    onPress: () => void;
    children: React.ReactNode;
    style?: any;
}) {
    const opacity = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <AnimatedPressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onPressIn={() => {
                opacity.value = withTiming(0.5, { duration: 80 });
            }}
            onPressOut={() => {
                opacity.value = withTiming(1, { duration: 150 });
            }}
            style={[style, animStyle]}
        >
            {children}
        </AnimatedPressable>
    );
}

// ── Animated Segmented Control (sliding pill, no bouncy tabs) ──
function TemplateSegment({
    templates,
    selected,
    onSelect,
}: {
    templates: { key: TemplateType; label: string; Icon: any }[];
    selected: TemplateType;
    onSelect: (key: TemplateType) => void;
}) {
    const pillX = useSharedValue(templates.findIndex(t => t.key === selected));

    useEffect(() => {
        const idx = templates.findIndex(t => t.key === selected);
        pillX.value = withSpring(idx, { damping: 22, stiffness: 260, mass: 0.8 });
    }, [selected]);

    const segmentWidth = (SCREEN_WIDTH - 48 - 8) / templates.length;

    const pillStyle = useAnimatedStyle(() => ({
        transform: [{
            translateX: interpolate(
                pillX.value,
                [0, templates.length - 1],
                [0, segmentWidth * (templates.length - 1)],
                Extrapolation.CLAMP,
            ),
        }],
        width: segmentWidth,
    }));

    return (
        <View style={styles.segmentContainer}>
            {/* Sliding pill */}
            <Animated.View style={[styles.segmentPill, pillStyle]} />

            {templates.map((t) => {
                const isActive = selected === t.key;
                return (
                    <OpacityButton
                        key={t.key}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onSelect(t.key);
                        }}
                        style={styles.segmentTab}
                    >
                        <t.Icon size={14} color={isActive ? '#0f172a' : '#94a3b8'} />
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: isActive ? '600' : '500',
                                color: isActive ? '#0f172a' : '#94a3b8',
                            }}
                        >
                            {t.label}
                        </Text>
                    </OpacityButton>
                );
            })}
        </View>
    );
}

// ── Main Modal ──
export function ShareWorkoutModal({ visible, onClose, data, sessionId }: ShareWorkoutModalProps) {
    const insets = useSafeAreaInsets();
    const scale = useSharedValue(0);
    const viewShotRef = useRef<ViewShot>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('photo');
    const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);

    const { volume: statsVolume, maxLoads: statsMaxLoads, exerciseDetails: statsExerciseDetails } = useSessionStats(sessionId || null);

    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1, { damping: 24, stiffness: 260, mass: 0.9 });
        } else {
            scale.value = withTiming(0, { duration: 200 });
            setTimeout(() => {
                setSelectedTemplate('photo');
                setBackgroundImage(undefined);
            }, 300);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: interpolate(scale.value, [0, 0.6, 1], [0, 0.9, 1], Extrapolation.CLAMP),
    }));

    // Share button press physics — firm, no oscillation
    const shareScale = useSharedValue(1);
    const shareAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: shareScale.value }],
    }));

    const handleSharePressIn = useCallback(() => {
        shareScale.value = withTiming(0.98, { duration: 120, easing: Easing.out(Easing.ease) });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    const handleSharePressOut = useCallback(() => {
        shareScale.value = withSpring(1, { damping: 28, stiffness: 400, mass: 0.7 });
    }, []);

    const handlePickImage = useCallback(async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Desculpe', 'Precisamos de permissão para acessar suas fotos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
        });
        if (!result.canceled) setBackgroundImage(result.assets[0].uri);
    }, []);

    const handleTakePhoto = useCallback(async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Desculpe', 'Precisamos de permissão para acessar a câmera.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 1,
        });
        if (!result.canceled) setBackgroundImage(result.assets[0].uri);
    }, []);

    const handleShare = useCallback(async () => {
        if (!viewShotRef.current) return;
        setIsSharing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const uri = await captureRef(viewShotRef, {
                format: 'png',
                quality: 1.0,
                result: 'tmpfile',
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Compartilhar Treino',
                ...(Platform.OS === 'ios' ? { UTI: 'public.png' } : {}),
            });
        } catch (error) {
            console.error("Error sharing:", error);
            Alert.alert("Erro", "Não foi possível compartilhar a imagem.");
        } finally {
            setIsSharing(false);
        }
    }, []);

    if (!data) return null;

    const templateData: ShareableCardProps = {
        ...data,
        backgroundImageUri: backgroundImage,
        volume: statsVolume || data.volume,
        maxLoads: (statsMaxLoads && statsMaxLoads.length > 0) ? statsMaxLoads : data.maxLoads,
        exerciseDetails: (statsExerciseDetails && statsExerciseDetails.length > 0) ? statsExerciseDetails : data.exerciseDetails,
    };

    const templates: { key: TemplateType; label: string; Icon: any }[] = [
        { key: 'photo', label: 'Foto', Icon: Camera },
        { key: 'highlights', label: 'Destaques', Icon: Trophy },
        { key: 'full_workout', label: 'Completo', Icon: FileText },
        { key: 'summary', label: 'Resumo', Icon: LayoutTemplate },
    ];

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View style={[animatedStyle, styles.modalSheet]}>
                    {/* ── Header ── */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Compartilhar Resultado</Text>
                        <OpacityButton onPress={onClose} style={styles.closeButton}>
                            <X size={18} color="#64748b" strokeWidth={2.5} />
                        </OpacityButton>
                    </View>

                    {/* ── Preview (large, dominant) ── */}
                    <View style={styles.previewWrapper}>
                        <View style={styles.previewFrame}>
                            <ViewShot
                                ref={viewShotRef}
                                options={{ format: "png", quality: 1.0 }}
                                style={{
                                    width: CARD_W,
                                    height: CARD_H,
                                    transform: [{ scale: PREVIEW_SCALE }],
                                }}
                            >
                                {selectedTemplate === 'photo' && <PhotoOverlayTemplate {...templateData} />}
                                {selectedTemplate === 'highlights' && <MaxLoadsTemplate {...templateData} />}
                                {selectedTemplate === 'full_workout' && <FullWorkoutTemplate {...templateData} />}
                                {selectedTemplate === 'summary' && <SummaryTemplate {...templateData} />}
                                {selectedTemplate === 'pr' && <PRTemplate {...templateData} />}
                            </ViewShot>
                        </View>
                    </View>

                    {/* ── Segmented Control ── */}
                    <TemplateSegment
                        templates={templates}
                        selected={selectedTemplate}
                        onSelect={setSelectedTemplate}
                    />

                    {/* ── Photo Controls ── */}
                    {selectedTemplate === 'photo' && (
                        <View style={styles.photoControls}>
                            <OpacityButton onPress={handlePickImage} style={styles.photoButton}>
                                <ImageIcon size={20} color="#475569" />
                                <Text style={styles.photoButtonText}>Galeria</Text>
                            </OpacityButton>
                            <OpacityButton onPress={handleTakePhoto} style={styles.photoButton}>
                                <Camera size={20} color="#475569" />
                                <Text style={styles.photoButtonText}>Câmera</Text>
                            </OpacityButton>
                        </View>
                    )}

                    {/* ── Share Button (Liquid Glass — firm press) ── */}
                    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
                        <AnimatedPressable
                            onPress={handleShare}
                            onPressIn={handleSharePressIn}
                            onPressOut={handleSharePressOut}
                            disabled={isSharing}
                            style={[styles.shareButton, shareAnimStyle]}
                        >
                            {isSharing ? (
                                <Text style={styles.shareText}>Gerando...</Text>
                            ) : (
                                <>
                                    <Share2 size={20} color="white" />
                                    <Text style={styles.shareText}>Compartilhar</Text>
                                </>
                            )}
                        </AnimatedPressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 20,
        paddingBottom: 14,
        paddingHorizontal: 24,
        position: 'relative',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0f172a',
        letterSpacing: 0.2,
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        top: 16,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Preview ──
    previewWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        height: SCALED_H + 12,
        marginBottom: 24,
    },
    previewFrame: {
        width: CARD_W,
        height: CARD_H,
        position: 'absolute',
        transform: [{ scale: PREVIEW_SCALE }],
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 6,
    },

    // ── Segmented Control ──
    segmentContainer: {
        backgroundColor: '#f1f5f9',
        borderRadius: 14,
        padding: 4,
        flexDirection: 'row',
        marginHorizontal: 24,
        marginBottom: 20,
        position: 'relative',
    },
    segmentPill: {
        position: 'absolute',
        top: 4,
        left: 4,
        bottom: 4,
        borderRadius: 11,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    segmentTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 5,
        zIndex: 1,
    },

    // ── Photo Controls ──
    photoControls: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
        marginBottom: 20,
        paddingHorizontal: 24,
    },
    photoButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
    },
    photoButtonText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '500',
    },

    // ── Share Button ──
    footer: {
        paddingHorizontal: 24,
    },
    shareButton: {
        backgroundColor: '#7c3aed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    shareText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.2,
    },
});
