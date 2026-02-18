import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform, Alert, Dimensions, StyleSheet, ScrollView } from 'react-native';
import { Share2, X, Camera, Image as ImageIcon, LayoutTemplate, Trophy, FileText } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
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

const { width } = Dimensions.get('window');

type TemplateType = 'photo' | 'highlights' | 'full_workout' | 'summary' | 'pr';

export function ShareWorkoutModal({ visible, onClose, data, sessionId }: ShareWorkoutModalProps) {
    const scale = useSharedValue(0);
    const viewShotRef = useRef<ViewShot>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('photo');
    const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);

    const { volume: statsVolume, maxLoads: statsMaxLoads, exerciseDetails: statsExerciseDetails } = useSessionStats(sessionId || null);

    useEffect(() => {
        if (visible) {
            scale.value = withSequence(
                withSpring(1.05),
                withSpring(1)
            );
        } else {
            scale.value = 0;
            setTimeout(() => {
                setSelectedTemplate('photo');
                setBackgroundImage(undefined);
            }, 300);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Desculpe', 'Precisamos de permissão para acessar suas fotos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
        });

        if (!result.canceled) {
            setBackgroundImage(result.assets[0].uri);
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Desculpe', 'Precisamos de permissão para acessar a câmera.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
        });

        if (!result.canceled) {
            setBackgroundImage(result.assets[0].uri);
        }
    };

    const handleShare = async () => {
        if (!viewShotRef.current) return;
        setIsSharing(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            const uri = await captureRef(viewShotRef, {
                format: 'png',
                quality: 1.0,
                result: 'tmpfile'
            });

            if (Platform.OS === 'android') {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Compartilhar Treino'
                });
            } else {
                await Sharing.shareAsync(uri, {
                    UTI: 'public.png',
                    mimeType: 'image/png',
                    dialogTitle: 'Compartilhar Treino'
                });
            }

        } catch (error) {
            console.error("Error sharing:", error);
            Alert.alert("Erro", "Não foi possível compartilhar a imagem.");
        } finally {
            setIsSharing(false);
        }
    };

    if (!data) return null;

    const templateData: ShareableCardProps = {
        ...data,
        backgroundImageUri: backgroundImage,
        volume: statsVolume || data.volume,
        maxLoads: (statsMaxLoads && statsMaxLoads.length > 0) ? statsMaxLoads : data.maxLoads,
        exerciseDetails: (statsExerciseDetails && statsExerciseDetails.length > 0) ? statsExerciseDetails : data.exerciseDetails
    };

    const templates: { key: TemplateType; label: string; icon: React.ReactNode }[] = [
        { key: 'photo', label: 'Foto', icon: <Camera size={18} color={selectedTemplate === 'photo' ? 'white' : '#94A3B8'} /> },
        { key: 'highlights', label: 'Destaques', icon: <Trophy size={18} color={selectedTemplate === 'highlights' ? 'white' : '#94A3B8'} /> },
        { key: 'full_workout', label: 'Completo', icon: <FileText size={18} color={selectedTemplate === 'full_workout' ? 'white' : '#94A3B8'} /> },
        { key: 'summary', label: 'Resumo', icon: <LayoutTemplate size={18} color={selectedTemplate === 'summary' ? 'white' : '#94A3B8'} /> },
    ];

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Header */}
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <Animated.View style={[animatedStyle, styles.modalContent]}>
                    <Text style={styles.title}>Compartilhar Resultado</Text>

                    {/* Preview */}
                    <View style={styles.previewWrapper}>
                        <View style={styles.previewContainer}>
                            <ViewShot
                                ref={viewShotRef}
                                options={{ format: "png", quality: 1.0 }}
                                style={{
                                    width: 320,
                                    height: 568,
                                    transform: [{ scale: (width * 0.70) / 320 }],
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

                    {/* Template Selector */}
                    <View style={styles.templateSelector}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateList}>
                            {templates.map(t => (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[styles.templateOption, selectedTemplate === t.key && styles.selectedOption]}
                                    onPress={() => setSelectedTemplate(t.key)}
                                >
                                    {t.icon}
                                    <Text style={[styles.optionText, selectedTemplate === t.key && styles.selectedOptionText]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Photo Controls */}
                    {selectedTemplate === 'photo' && (
                        <View style={styles.photoControls}>
                            <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
                                <ImageIcon size={20} color="#94A3B8" />
                                <Text style={styles.photoButtonText}>Galeria</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                                <Camera size={20} color="#94A3B8" />
                                <Text style={styles.photoButtonText}>Câmera</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Share Button */}
                    <View style={styles.footerActions}>
                        <TouchableOpacity
                            onPress={handleShare}
                            disabled={isSharing}
                            style={styles.shareButton}
                        >
                            {isSharing ? (
                                <Text style={styles.buttonText}>Gerando...</Text>
                            ) : (
                                <>
                                    <Share2 size={20} color="white" />
                                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>Compartilhar</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'flex-start',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        zIndex: 50,
    },
    closeButton: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        padding: 8,
        borderRadius: 20,
    },
    modalContent: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 10,
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 10,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    previewWrapper: {
        height: (width * 0.70) * (16 / 9),
        width: width * 0.70,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    previewContainer: {
        width: 320,
        height: 568,
        position: 'absolute',
        transform: [{ scale: (width * 0.70) / 320 }],
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    templateSelector: {
        marginBottom: 16,
        paddingHorizontal: 20,
        height: 50,
    },
    templateList: {
        gap: 10,
        paddingHorizontal: 10,
    },
    templateOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 6,
    },
    selectedOption: {
        backgroundColor: '#4338CA',
        borderColor: '#6366F1',
    },
    optionText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 13,
    },
    selectedOptionText: {
        color: 'white',
    },
    photoControls: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    photoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    photoButtonText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
    },
    footerActions: {
        width: '100%',
        paddingHorizontal: 32,
        marginBottom: 40,
    },
    shareButton: {
        width: '100%',
        backgroundColor: '#7C3AED',
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
