/**
 * TrainingRoomSettingsSheet — bottom sheet de configurações da Sala de Treino.
 * Casa extensível para as preferências do treinador (globais, device-local via
 * trainingRoomPreferencesStore). v1: timer de descanso automático + duração padrão.
 *
 * Gotcha RN 0.81/Fabric: usar Pressable com style OBJETO (nunca style-função inline),
 * senão backgroundColor/flex não pintam.
 */
import React from 'react';
import { View, Text, Modal, Pressable, Switch } from 'react-native';
import { X, Minus, Plus, Timer } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';
import {
    useTrainingRoomPreferencesStore,
    MIN_REST_SECONDS,
    MAX_REST_SECONDS,
    REST_STEP_SECONDS,
} from '../../stores/trainingRoomPreferencesStore';

interface TrainingRoomSettingsSheetProps {
    visible: boolean;
    onClose: () => void;
}

export function TrainingRoomSettingsSheet({ visible, onClose }: TrainingRoomSettingsSheetProps) {
    const colors = useV2Colors();
    const restTimerAuto = useTrainingRoomPreferencesStore((s) => s.restTimerAuto);
    const setRestTimerAuto = useTrainingRoomPreferencesStore((s) => s.setRestTimerAuto);
    const defaultRestSeconds = useTrainingRoomPreferencesStore((s) => s.defaultRestSeconds);
    const setDefaultRestSeconds = useTrainingRoomPreferencesStore((s) => s.setDefaultRestSeconds);

    const toggleTimer = (v: boolean) => {
        Haptics.selectionAsync();
        setRestTimerAuto(v);
    };

    const adjustRest = (delta: number) => {
        Haptics.selectionAsync();
        setDefaultRestSeconds(defaultRestSeconds + delta);
    };

    const canDecrement = restTimerAuto && defaultRestSeconds > MIN_REST_SECONDS;
    const canIncrement = restTimerAuto && defaultRestSeconds < MAX_REST_SECONDS;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
            >
                {/* Card — Pressable interno absorve o toque para não fechar. */}
                <Pressable
                    onPress={() => {}}
                    style={{
                        backgroundColor: colors.surface.canvas,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingTop: 10,
                        paddingBottom: 34,
                        paddingHorizontal: 20,
                    }}
                >
                    {/* Handle */}
                    <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.surface.card2, marginBottom: 14 }} />

                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text.primary }}>
                            Configurações da Sala
                        </Text>
                        <Pressable
                            onPress={onClose}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar"
                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={18} color={colors.text.secondary} />
                        </Pressable>
                    </View>

                    {/* Timer de descanso automático */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.subtle, padding: 14 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: toRgba(colors.purple[600], 0.12), alignItems: 'center', justifyContent: 'center' }}>
                            <Timer size={18} color={colors.purple[600]} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.text.primary }}>
                                Timer de descanso automático
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2, lineHeight: 16 }}>
                                Inicia a contagem de descanso ao concluir cada série.
                            </Text>
                        </View>
                        <Switch
                            value={restTimerAuto}
                            onValueChange={toggleTimer}
                            trackColor={{ false: colors.surface.card2, true: colors.purple[600] }}
                            thumbColor="#fff"
                        />
                    </View>

                    {/* Duração padrão (esmaece quando o timer está desligado) */}
                    <View style={{ opacity: restTimerAuto ? 1 : 0.4, marginTop: 12, backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.subtle, padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.text.primary }}>
                                    Duração padrão
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2, lineHeight: 16 }}>
                                    Usada quando o exercício não tem descanso definido.
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Pressable
                                    disabled={!canDecrement}
                                    onPress={() => adjustRest(-REST_STEP_SECONDS)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Diminuir descanso"
                                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center', opacity: canDecrement ? 1 : 0.4 }}
                                >
                                    <Minus size={16} color={colors.text.primary} />
                                </Pressable>
                                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text.primary, minWidth: 46, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                                    {defaultRestSeconds}s
                                </Text>
                                <Pressable
                                    disabled={!canIncrement}
                                    onPress={() => adjustRest(REST_STEP_SECONDS)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar descanso"
                                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center', opacity: canIncrement ? 1 : 0.4 }}
                                >
                                    <Plus size={16} color={colors.text.primary} />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
