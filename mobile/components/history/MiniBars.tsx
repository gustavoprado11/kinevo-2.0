/**
 * MiniBars — barras das últimas 8 semanas (JourneyCard).
 *
 * Normaliza pelo máximo da janela, com piso de 8% pra barra vazia não sumir.
 * Semanas com ≥1 treino usam brand; vazias usam um tom apagado.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface MiniBarsProps {
    /** Contagens semanais, mais antiga primeiro. Idealmente 8 entradas. */
    counts: number[];
    width?: number;
    height?: number;
    gap?: number;
    /** Cor das semanas com treino. */
    activeColor?: string;
    /** Cor das semanas vazias. */
    emptyColor?: string;
    style?: StyleProp<ViewStyle>;
}

export function MiniBars({
    counts,
    width = 130,
    height = 48,
    gap = 3,
    activeColor = '#6D28D9',
    emptyColor = '#EDE9FE',
    style,
}: MiniBarsProps) {
    // Garante 8 entradas, preenchendo o início com zeros.
    const padded = counts.length >= 8 ? counts.slice(-8) : [...new Array(8 - counts.length).fill(0), ...counts];
    const max = Math.max(1, ...padded);
    const weeksWithWorkout = padded.filter((c) => c > 0).length;

    return (
        <View
            accessibilityRole="image"
            accessibilityLabel={`Últimas 8 semanas: ${weeksWithWorkout} ${weeksWithWorkout === 1 ? 'semana' : 'semanas'} com treino`}
            style={[{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap }, style]}
        >
            {padded.map((count, i) => {
                const ratio = count / max;
                const barHeight = Math.max(height * 0.08, height * ratio);
                return (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            height: barHeight,
                            borderRadius: 3,
                            backgroundColor: count > 0 ? activeColor : emptyColor,
                        }}
                    />
                );
            })}
        </View>
    );
}
