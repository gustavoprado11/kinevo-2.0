import React from 'react';
import { View, Text, ScrollView, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardCheck } from 'lucide-react-native';
import Animated, { FadeInUp, Easing } from 'react-native-reanimated';
import { FormRenderer } from '../forms/FormRenderer';
import type { TriggerData } from '../../hooks/useWorkoutFormTriggers';

interface PostWorkoutFormSheetProps {
    visible: boolean;
    trigger: TriggerData;
    onSubmit: (answers: Record<string, any>) => Promise<void>;
    onSkip: () => void;
}

export function PostWorkoutFormSheet({ visible, trigger, onSubmit, onSkip }: PostWorkoutFormSheetProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, backgroundColor: '#F2F2F7' }}
            >
                <View style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? 20 : insets.top }}>
                    {/* Header */}
                    <Animated.View
                        entering={FadeInUp.delay(100).duration(300).easing(Easing.out(Easing.cubic))}
                        style={{
                            paddingHorizontal: 20,
                            paddingBottom: 16,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <ClipboardCheck size={20} color="#10b981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 17 }}>
                                    {trigger.title}
                                </Text>
                                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                                    Check-in pós-treino
                                </Text>
                            </View>
                        </View>
                        <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 19 }}>
                            Responda antes de finalizar
                        </Text>
                    </Animated.View>

                    {/* Form */}
                    <ScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: Math.max(insets.bottom, 20) + 16,
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Animated.View entering={FadeInUp.delay(200).duration(300).easing(Easing.out(Easing.cubic))}>
                            <FormRenderer
                                mode="inline"
                                schema={trigger.schemaJson}
                                onSubmit={onSubmit}
                                onSkip={onSkip}
                                submitLabel="Enviar e finalizar"
                                skipLabel="Pular"
                            />
                        </Animated.View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
