import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme';

interface AdaptiveModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: number;
}

export function AdaptiveModal({
    visible,
    onClose,
    title,
    children,
    width = 480,
}: AdaptiveModalProps) {
    const { isTablet } = useResponsive();
    const insets = useSafeAreaInsets();
    const slideX = useSharedValue(width);

    useEffect(() => {
        if (visible && isTablet) {
            slideX.value = withTiming(0, { duration: 250 });
        } else {
            slideX.value = width;
        }
    }, [visible, isTablet, width]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: slideX.value }],
    }));

    if (!isTablet) {
        // Phone: standard fullscreen slide-up modal
        return (
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
                    {title && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 20,
                                paddingTop: insets.top + 12,
                                paddingBottom: 12,
                                borderBottomWidth: 0.5,
                                borderBottomColor: colors.border.primary,
                            }}
                        >
                            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary }}>
                                {title}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                                <X size={20} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {children}
                </View>
            </Modal>
        );
    }

    // Tablet: right-side sheet with dimmed overlay
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, flexDirection: 'row' }}>
                {/* Dimmed overlay */}
                <Pressable
                    onPress={onClose}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
                />

                {/* Sheet from right */}
                <Animated.View
                    style={[
                        {
                            width,
                            backgroundColor: colors.background.primary,
                            borderTopLeftRadius: 20,
                            borderBottomLeftRadius: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: -4, height: 0 },
                            shadowOpacity: 0.15,
                            shadowRadius: 20,
                            elevation: 10,
                        },
                        sheetStyle,
                    ]}
                >
                    {title && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 20,
                                paddingTop: insets.top + 12,
                                paddingBottom: 12,
                                borderBottomWidth: 0.5,
                                borderBottomColor: colors.border.primary,
                            }}
                        >
                            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text.primary }}>
                                {title}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                                <X size={20} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}
