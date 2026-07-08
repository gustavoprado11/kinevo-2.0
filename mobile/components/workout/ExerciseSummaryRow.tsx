/**
 * ExerciseSummaryRow — a "linha-resumo" de um item no modo Lista completa:
 * pílula numerada + nome + meta + chip de status. É o estado RECOLHIDO de um
 * exercício/superset (e também o cabeçalho do card expandido). Fase 2.
 *
 * Estados (handoff): 'done' (pílula roxa + check, chip Concluído), 'current'
 * (pílula roxa + número, chip Em andamento), 'todo' (pílula neutra + número,
 * chip A fazer).
 *
 * Gotcha RN 0.81: Pressable com style ESTÁTICO (nunca style-função inline).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

export type ExerciseStatus = 'done' | 'current' | 'todo';

const SUCCESS = '#16A34A';

interface ExerciseSummaryRowProps {
    number: number;
    name: string;
    meta: string;
    status: ExerciseStatus;
    /** Mostra o chevron e torna a linha tocável. `undefined` = não interativa. */
    onPress?: () => void;
    /** Direção do chevron: true = expandido (para cima). */
    expanded?: boolean;
}

export function ExerciseSummaryRow({ number, name, meta, status, onPress, expanded }: ExerciseSummaryRowProps) {
    const colors = useV2Colors();

    const pillBg = status === 'todo' ? colors.surface.card2 : colors.purple[600];
    const pillFg = status === 'todo' ? colors.text.secondary : '#FFFFFF';

    const chip = (() => {
        switch (status) {
            case 'done': return { bg: 'rgba(22,163,74,0.12)', fg: SUCCESS, label: 'Concluído' };
            case 'current': return { bg: toRgba(colors.purple[600], 0.12), fg: colors.purple[700], label: 'Em andamento' };
            default: return { bg: colors.surface.card2, fg: colors.text.tertiary, label: 'A fazer' };
        }
    })();

    const Chevron = expanded ? ChevronUp : ChevronDown;

    const content = (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: pillBg, alignItems: 'center', justifyContent: 'center' }}>
                {status === 'done'
                    ? <Check size={16} color={pillFg} strokeWidth={3} />
                    : <Text style={{ fontSize: 13, fontWeight: '800', color: pillFg }}>{number}</Text>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: colors.text.primary }}>{name}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.text.tertiary, marginTop: 1 }}>{meta}</Text>
            </View>
            <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: chip.bg }}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: chip.fg }}>{chip.label}</Text>
            </View>
            {onPress ? <Chevron size={16} color={colors.text.quaternary} strokeWidth={2} /> : null}
        </View>
    );

    if (!onPress) {
        return content;
    }
    return (
        <Pressable
            onPress={() => { Haptics.selectionAsync(); onPress(); }}
            accessibilityRole="button"
            accessibilityLabel={`${name}. ${chip.label}. Toque para ${expanded ? 'recolher' : 'expandir'}.`}
            style={{ paddingVertical: 2 }}
        >
            {content}
        </Pressable>
    );
}
