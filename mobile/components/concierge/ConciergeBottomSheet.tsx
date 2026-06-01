// Bottom sheet equivalente ao ConciergeModal do web: 3 passos + CTA WhatsApp.
// Mantém o mesmo idioma visual do dashboard (card claro, acentos violeta),
// adaptado pra padrão mobile (slide-up sheet com backdrop).
import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { X, Video, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

interface ConciergeBottomSheetProps {
    visible: boolean;
    /** Origem do clique (ex.: 'biblioteca_mobile_button'). */
    source: string;
    onClose: () => void;
}

const WHATSAPP_NUMBER = '5531999064997';
const WHATSAPP_MESSAGE = 'Oi, vim do Kinevo. Quero montar minha biblioteca de vídeos com a equipe.';

const STEPS = [
    'Você nos envia seus vídeos (Drive, WeTransfer, WhatsApp)',
    'A equipe nomeia, organiza e atribui a cada exercício',
    'Sua biblioteca aparece pronta em até 24h úteis',
];

async function recordRequest(source: string): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: trainer } = await supabase
            .from('trainers' as any)
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
        const trainerId = (trainer as { id?: string } | null)?.id;
        if (!trainerId) return;
        await supabase.from('concierge_requests' as any).insert({
            trainer_id: trainerId,
            source,
            channel: 'whatsapp',
        } as any);
    } catch (err) {
        if (__DEV__) console.warn('[concierge] record failed (silent):', err);
    }
}

export function ConciergeBottomSheet({ visible, source, onClose }: ConciergeBottomSheetProps) {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setError(null);
        setIsLoading(true);
        try {
            // Grava lead (best-effort) e abre WhatsApp em paralelo — o registro
            // não bloqueia a abertura.
            await recordRequest(source);
            const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                setError('Não foi possível abrir o WhatsApp neste dispositivo.');
                return;
            }
            await Linking.openURL(url);
            onClose();
        } catch (err) {
            if (__DEV__) console.warn('[concierge] open failed:', err);
            setError('Não conseguimos abrir o WhatsApp. Tente de novo.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
            >
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        marginTop: 'auto',
                        backgroundColor: colors.surface.card,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingHorizontal: 24,
                        paddingTop: 22,
                        paddingBottom: insets.bottom + 22,
                    }}
                >
                    {/* Handle bar */}
                    <View
                        style={{
                            width: 36,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.border.default,
                            alignSelf: 'center',
                            marginBottom: 18,
                        }}
                    />

                    {/* Close X (topo direito) */}
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityLabel="Fechar"
                        style={{
                            position: 'absolute',
                            top: 18,
                            right: 18,
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: colors.neutral[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={14} color={colors.text.tertiary} />
                    </TouchableOpacity>

                    {/* Header: ícone + eyebrow + status */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                        <View
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 16,
                                backgroundColor: toRgba(colors.purple[600], 0.10),
                                borderWidth: 1,
                                borderColor: toRgba(colors.purple[600], 0.20),
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Video size={20} color={colors.purple[600]} strokeWidth={1.8} />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: '800',
                                    letterSpacing: 1.4,
                                    color: colors.text.tertiary,
                                    textTransform: 'uppercase',
                                }}
                            >
                                Concierge
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: '#10B981',
                                    }}
                                />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>
                                    Equipe disponível
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Title + body */}
                    <Text
                        style={{
                            fontSize: 22,
                            fontWeight: '800',
                            color: colors.text.primary,
                            letterSpacing: -0.4,
                            marginBottom: 8,
                        }}
                    >
                        Biblioteca pronta em 24h
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.text.tertiary,
                            lineHeight: 21,
                            marginBottom: 18,
                        }}
                    >
                        Mande seus vídeos pra equipe Kinevo, a gente coloca cada um no exercício certo do seu programa. Você não levanta um dedo.
                    </Text>

                    {/* Steps */}
                    <View style={{ gap: 10, marginBottom: 22 }}>
                        {STEPS.map((t, i) => (
                            <View
                                key={i}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 11,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border.default,
                                    backgroundColor: colors.neutral[50],
                                }}
                            >
                                <View
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        backgroundColor: colors.purple[100],
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.purple[700] }}>
                                        {i + 1}
                                    </Text>
                                </View>
                                <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text.secondary }}>
                                    {t}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {error && (
                        <View
                            style={{
                                marginBottom: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: 'rgba(239,68,68,0.30)',
                                backgroundColor: 'rgba(239,68,68,0.10)',
                            }}
                        >
                            <Text style={{ fontSize: 12, color: '#B91C1C' }}>{error}</Text>
                        </View>
                    )}

                    {/* CTA */}
                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={isLoading}
                        accessibilityRole="button"
                        accessibilityLabel="Falar no WhatsApp"
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            paddingVertical: 14,
                            borderRadius: 14,
                            backgroundColor: colors.purple[600],
                            opacity: isLoading ? 0.7 : 1,
                            shadowColor: colors.purple[600],
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.25,
                            shadowRadius: 12,
                            elevation: 4,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.2} />
                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                                    Falar no WhatsApp
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <Text
                        style={{
                            marginTop: 10,
                            fontSize: 12,
                            fontWeight: '500',
                            color: colors.text.tertiary,
                            textAlign: 'center',
                        }}
                    >
                        Resposta em até 1h em horário comercial
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
