import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Share, Platform, Alert, Dimensions } from 'react-native';
import { Trophy, Share2, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
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
    };
}

const { width } = Dimensions.get('window');

export function WorkoutSuccessModal({ visible, onClose, data }: WorkoutSuccessModalProps) {
    const scale = useSharedValue(0);
    const [shareModalVisible, setShareModalVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            scale.value = withSequence(
                withSpring(1.05),
                withSpring(1)
            );
        } else {
            scale.value = 0;
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    // Removed handleShare logic in favor of opening ShareWorkoutModal
    const handleOpenShare = () => {
        setShareModalVisible(true);
    };

    if (!data) return null; // Should not happen given logic in parent

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/95 justify-center items-center p-4">

                {/* Close Button */}
                <TouchableOpacity
                    onPress={onClose}
                    className="absolute top-12 right-6 z-50 bg-slate-800/50 p-2 rounded-full"
                >
                    <X size={24} color="white" />
                </TouchableOpacity>

                <Animated.View style={[animatedStyle, { width: '100%', alignItems: 'center' }]}>

                    <Text className="text-white text-2xl font-bold mb-6 text-center">
                        Treino Finalizado! 🔥
                    </Text>

                    {/* Preview Container */}
                    <View
                        style={{
                            width: width * 0.75,
                            height: (width * 0.75) * (16 / 9),
                            overflow: 'hidden',
                            borderRadius: 24,
                            marginBottom: 24,
                            backgroundColor: '#0F172A',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <WorkoutShareableCard {...data} />
                    </View>


                    {/* Action Buttons */}
                    <View className="w-full px-4 mb-4">
                        <TouchableOpacity
                            onPress={handleOpenShare}
                            activeOpacity={0.8}
                            className="w-full rounded-2xl overflow-hidden shadow-lg shadow-violet-500/40"
                        >
                            <BlurView intensity={80} tint="light" className="bg-violet-600/85">
                                <View className="border border-white/20 rounded-2xl overflow-hidden">
                                    <LinearGradient
                                        colors={['rgba(139, 92, 246, 0.5)', 'rgba(109, 40, 217, 0.5)']}
                                        className="h-14 flex-row items-center justify-center gap-2"
                                    >
                                        <Share2 size={20} color="white" />
                                        <Text className="text-white font-bold text-lg">Compartilhar Resultado</Text>
                                    </LinearGradient>
                                </View>
                            </BlurView>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.7}
                            className="w-full h-14 bg-slate-800 rounded-2xl items-center justify-center mt-3 border border-white/10"
                        >
                            <Text className="text-white font-bold text-lg">Voltar ao Início</Text>
                        </TouchableOpacity>
                    </View>

                </Animated.View>
            </View>
            <ShareWorkoutModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                data={data}
                sessionId={(data as any).sessionId} // Passing sessionId we added in workout/[id]
            />
        </Modal>
    );
}

