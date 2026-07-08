/**
 * WorkoutFocusNav — barra fixa "Voltar / Próximo exercício" do modo Foco.
 * Sempre visível acima do player (Fase 4) — o aluno nunca rola atrás de um botão.
 * No último item, o "Próximo" vira "Concluir" e chama onFinish. Fase 3.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '../../hooks/useV2Colors';

interface WorkoutFocusNavProps {
    index: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
    /** Chamado quando "Próximo" é tocado no último item. */
    onFinish?: () => void;
}

export function WorkoutFocusNav({ index, total, onPrev, onNext, onFinish }: WorkoutFocusNavProps) {
    const colors = useV2Colors();
    const isLast = index >= total - 1;
    const canPrev = index > 0;

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isLast) onFinish?.();
        else onNext();
    };

    const handlePrev = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPrev();
    };

    return (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: colors.surface.canvas }}>
            <Pressable
                onPress={canPrev ? handlePrev : undefined}
                disabled={!canPrev}
                accessibilityRole="button"
                accessibilityLabel="Exercício anterior"
                style={{ width: 48, height: 46, borderRadius: 13, backgroundColor: colors.surface.card2, alignItems: 'center', justifyContent: 'center', opacity: canPrev ? 1 : 0.4 }}
            >
                <ChevronLeft size={19} color={colors.text.secondary} />
            </Pressable>
            <Pressable
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel={isLast ? 'Concluir treino' : 'Próximo exercício'}
                style={{
                    flex: 1, height: 46, borderRadius: 13, backgroundColor: colors.purple[600],
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    shadowColor: colors.purple[600], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 4,
                }}
            >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                    {isLast ? 'Concluir treino' : 'Próximo exercício'}
                </Text>
                {isLast ? <Check size={18} color="#fff" strokeWidth={2.4} /> : <ChevronRight size={18} color="#fff" strokeWidth={2.4} />}
            </Pressable>
        </View>
    );
}
