import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Trophy, Check } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withDelay } from 'react-native-reanimated';

interface WorkoutSuccessModalProps {
    visible: boolean;
    onClose: () => void;
}

export function WorkoutSuccessModal({ visible, onClose }: WorkoutSuccessModalProps) {
    const scale = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            scale.value = withSequence(
                withSpring(1.2),
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

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => { }} // Prevent closing by back button during success
        >
            <View className="flex-1 bg-black/90 justify-center items-center p-6">
                <Animated.View style={animatedStyle} className="bg-slate-900 w-full rounded-3xl p-8 items-center border border-slate-800">

                    {/* Icon Circle */}
                    <View className="w-24 h-24 bg-violet-600/20 rounded-full items-center justify-center mb-6 border border-violet-500/30">
                        <Trophy size={48} color="#A78BFA" strokeWidth={1.5} />
                    </View>

                    <Text className="text-2xl font-bold text-white mb-2 text-center">
                        Parabéns!
                    </Text>

                    <Text className="text-slate-400 text-center mb-8 text-base">
                        Treino concluído com sucesso. Você está um passo mais perto do seu objetivo.
                    </Text>

                    <TouchableOpacity
                        onPress={onClose}
                        className="w-full bg-violet-600 py-4 rounded-xl flex-row items-center justify-center space-x-2"
                    >
                        <Text className="text-white font-bold text-base">Voltar ao Início</Text>
                    </TouchableOpacity>

                </Animated.View>
            </View>
        </Modal>
    );
}
