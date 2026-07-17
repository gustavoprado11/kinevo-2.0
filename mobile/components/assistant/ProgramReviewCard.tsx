/**
 * ProgramReviewCard — card do programa gerado pela IA (Frame 3 do design).
 *
 * Apresentacional: recebe a estrutura do programa por props. Na Fase 2 será
 * alimentado pelo resultado real de generateProgram / draft do agente.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing, radius } = v2;

export interface ProgramDay {
    dow: string; // SEG, TER…
    label: string; // Inf. A
}

export interface ProgramExercise {
    name: string;
    scheme: string; // "4 × 8–10"
}

export interface ProgramDetail {
    dow: string;
    title: string;
    exercises: ProgramExercise[];
    extra?: string; // "+ 2 exercícios"
}

export interface ProgramData {
    studentName: string;
    studentInitials: string;
    studentMeta: string;
    tags: string[];
    emphasisTag?: string;
    days: ProgramDay[];
    detail: ProgramDetail;
}

export const DEMO_PROGRAM: ProgramData = {
    studentName: 'Marina Lanza',
    studentInitials: 'ML',
    studentMeta: 'Hipertrofia · desde fev/2025',
    tags: ['Hipertrofia', '4x / semana', '8 semanas'],
    emphasisTag: 'Ênfase posterior',
    days: [
        { dow: 'SEG', label: 'Inf. A' },
        { dow: 'TER', label: 'Sup. A' },
        { dow: 'QUI', label: 'Inf. B' },
        { dow: 'SEX', label: 'Sup. B' },
    ],
    detail: {
        dow: 'SEG',
        title: 'Inferior A — Posterior',
        exercises: [
            { name: 'Stiff com halteres', scheme: '4 × 8–10' },
            { name: 'Mesa flexora', scheme: '4 × 10–12' },
            { name: 'Elevação pélvica', scheme: '3 × 12' },
        ],
        extra: '+ 2 exercícios',
    },
};

export function ProgramReviewCard({ program = DEMO_PROGRAM }: { program?: ProgramData }) {
    const colors = useV2Colors();

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.purple[200],
                borderRadius: radius.lg,
                overflow: 'hidden',
            }}
        >
            {/* IA header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                    paddingVertical: 15,
                    paddingHorizontal: 17,
                    backgroundColor: colors.surface.tintPurple,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.purple[100],
                }}
            >
                <Sparkles size={16} color={colors.purple[600]} strokeWidth={1.7} />
                <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}>
                    Programa gerado
                </Text>
                <View style={{ backgroundColor: colors.purple[100], borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 9.5, color: colors.purple[600], letterSpacing: 0.3 }}>
                        IA
                    </Text>
                </View>
            </View>

            <View style={{ padding: 17 }}>
                {/* student */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: 14 }}>
                    <View
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.purple[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12, color: colors.purple[600] }}>
                            {program.studentInitials}
                        </Text>
                    </View>
                    <View>
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 14, color: colors.text.primary }}>
                            {program.studentName}
                        </Text>
                        <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11, color: colors.text.tertiary }}>
                            {program.studentMeta}
                        </Text>
                    </View>
                </View>

                {/* tags */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: 16 }}>
                    {program.tags.map((t) => (
                        <View key={t} style={{ backgroundColor: colors.surface.card2, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 }}>
                            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11.5, color: colors.text.secondary }}>
                                {t}
                            </Text>
                        </View>
                    ))}
                    {program.emphasisTag ? (
                        <View style={{ backgroundColor: colors.purple[100], borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 }}>
                            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11.5, color: colors.purple[600] }}>
                                {program.emphasisTag}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* weekly division */}
                <Text
                    style={{
                        fontFamily: 'MonaSans_700Bold',
                        fontSize: 11,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        color: colors.text.tertiary,
                        marginBottom: 10,
                    }}
                >
                    Divisão semanal
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: 16 }}>
                    {program.days.map((d) => (
                        <View
                            key={d.dow}
                            style={{
                                flex: 1,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                borderRadius: 12,
                                paddingVertical: 10,
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 10, color: colors.purple[600] }}>
                                {d.dow}
                            </Text>
                            <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 11.5, color: colors.text.primary, marginTop: 3 }}>
                                {d.label}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* day detail */}
                <View style={{ borderWidth: 1, borderColor: colors.border.default, borderRadius: 14, overflow: 'hidden' }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing[2],
                            paddingVertical: 11,
                            paddingHorizontal: 14,
                            backgroundColor: colors.surface.card2,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border.default,
                        }}
                    >
                        <View style={{ backgroundColor: colors.purple[600], borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 10, color: '#FFFFFF' }}>
                                {program.detail.dow}
                            </Text>
                        </View>
                        <Text style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 12.5, color: colors.text.primary }}>
                            {program.detail.title}
                        </Text>
                    </View>
                    <View style={{ paddingVertical: 5 }}>
                        {program.detail.exercises.map((ex, i) => (
                            <View
                                key={ex.name}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 9, paddingHorizontal: 15 }}
                            >
                                <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12, color: colors.text.quaternary, width: 14 }}>
                                    {i + 1}
                                </Text>
                                <Text style={{ flex: 1, fontFamily: 'MonaSans_500Medium', fontSize: 13, color: colors.text.primary }}>
                                    {ex.name}
                                </Text>
                                <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12, color: colors.text.secondary }}>
                                    {ex.scheme}
                                </Text>
                            </View>
                        ))}
                        {program.detail.extra ? (
                            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12, color: colors.purple[600], paddingVertical: 9, paddingHorizontal: 15 }}>
                                {program.detail.extra}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </View>
        </View>
    );
}
