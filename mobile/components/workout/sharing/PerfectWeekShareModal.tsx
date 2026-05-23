import React, { useRef, useState } from 'react';
import {
    View, Text, Modal, Pressable, Platform, Alert, useWindowDimensions, StyleSheet,
} from 'react-native';
import { X, Share2 } from 'lucide-react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerfectWeekTemplate, PerfectWeekCardProps } from './PerfectWeekTemplate';
import { CARD_W, CARD_H } from './_shared/tokens';

interface PerfectWeekShareModalProps {
    visible: boolean;
    onClose: () => void;
    data?: PerfectWeekCardProps;
}

export function PerfectWeekShareModal({ visible, onClose, data }: PerfectWeekShareModalProps) {
    const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const viewShotRef = useRef<ViewShot>(null);
    const [isSharing, setIsSharing] = useState(false);

    // Preview controlado — nunca domina a tela.
    const maxPreviewH = SCREEN_H * 0.5;
    const scale = Math.min((SCREEN_W - 64) / CARD_W, maxPreviewH / CARD_H);
    const scaledH = CARD_H * scale;

    const handleShare = async () => {
        if (!viewShotRef.current) return;
        setIsSharing(true);
        try {
            await new Promise((r) => setTimeout(r, 100));
            const uri = await captureRef(viewShotRef, { format: 'png', quality: 1, result: 'tmpfile' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Compartilhar semana perfeita',
                ...(Platform.OS === 'ios' ? { UTI: 'public.png' } : {}),
            });
        } catch (err) {
            if (__DEV__) console.error('[PerfectWeekShare]', err);
            Alert.alert('Erro', 'Não foi possível compartilhar a imagem.');
        } finally {
            setIsSharing(false);
        }
    };

    if (!data) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.container}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                        <X size={18} color="#94A3B8" strokeWidth={2.5} />
                    </Pressable>
                </View>

                <View style={styles.body} pointerEvents="box-none">
                    <Text style={styles.title}>Semana perfeita</Text>

                    {/* Preview escalado */}
                    <View style={{ width: CARD_W * scale, height: scaledH }}>
                        <View style={{
                            width: CARD_W, height: CARD_H,
                            transform: [
                                { scale },
                                { translateX: -(CARD_W - CARD_W * scale) / 2 },
                                { translateY: -(CARD_H - scaledH) / 2 },
                            ],
                            borderRadius: 24, overflow: 'hidden',
                        }}>
                            <PerfectWeekTemplate {...data} />
                        </View>
                    </View>

                    <Pressable
                        onPress={handleShare}
                        disabled={isSharing}
                        style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
                    >
                        <Share2 size={18} color="#fff" strokeWidth={2.4} />
                        <Text style={styles.shareText}>{isSharing ? 'Gerando…' : 'Compartilhar'}</Text>
                    </Pressable>
                </View>

                {/* Captura off-screen em tamanho real (1:1) */}
                <View style={styles.offscreen} pointerEvents="none">
                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
                        <PerfectWeekTemplate {...data} />
                    </ViewShot>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(9,9,15,0.82)' },
    header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 24 },
    title: { fontSize: 17, fontWeight: '700', color: '#F8FAFC' },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 15, paddingVertical: 15, paddingHorizontal: 28, alignSelf: 'stretch' },
    shareText: { fontSize: 16, fontWeight: '800', color: '#fff' },
    offscreen: { position: 'absolute', left: -9999, top: 0, width: CARD_W, height: CARD_H },
});
