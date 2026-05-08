import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@/theme';
import { supabase } from '../../../lib/supabase';
import { useAssessmentSession } from '../../../hooks/useAssessmentSession';
import { useAssessmentResultComparison } from '../../../hooks/useAssessmentResultComparison';
import { useStudentMetricsTimeline } from '../../../hooks/useStudentMetricsTimeline';
import { ResultStatsCard, type ResultStat } from '../../../components/trainer/assessments/ResultStatsCard';
import { ResultComparisonRow } from '../../../components/trainer/assessments/ResultComparisonRow';
import { HistoryMiniChart } from '../../../components/trainer/assessments/HistoryMiniChart';
import { classifyBMI } from '@kinevo/shared/lib/assessment-protocols';
import { parseFilenameFromHeader } from '@kinevo/shared/lib/http/parseFilename';
import type { ComputedMetrics } from '@kinevo/shared/types/assessments';

export default function ResultScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
    const session = useAssessmentSession(sessionId ?? null);

    const metrics = (session.detail?.session.computed_metrics as ComputedMetrics | null) ?? null;

    const comparison = useAssessmentResultComparison({
        studentId: session.detail?.session.student_id ?? null,
        currentSessionId: sessionId ?? null,
        currentTemplateId: session.detail?.session.template_id ?? null,
        currentMetrics: metrics,
    });

    const bfTimeline = useStudentMetricsTimeline({
        studentId: session.detail?.session.student_id ?? null,
        metricKey: 'body_fat_percent',
        limit: 12,
    });
    const bmiTimeline = useStudentMetricsTimeline({
        studentId: session.detail?.session.student_id ?? null,
        metricKey: 'bmi',
        limit: 12,
    });

    const stats: ResultStat[] = useMemo(() => {
        if (!metrics) return [];
        const out: ResultStat[] = [];
        if (typeof metrics.body_fat_percent === 'number') {
            out.push({ label: '% Gordura', value: `${metrics.body_fat_percent.toFixed(1)}%` });
        }
        if (typeof metrics.bmi === 'number') {
            const c = safeBmiClass(metrics.bmi);
            out.push({
                label: 'IMC',
                value: metrics.bmi.toFixed(1),
                classification: c?.label_pt,
                classification_color: colors.brand.primary,
            });
        }
        if (typeof metrics.lean_mass_kg === 'number') {
            out.push({ label: 'Massa magra', value: `${metrics.lean_mass_kg.toFixed(1)} kg` });
        }
        if (typeof metrics.fat_mass_kg === 'number') {
            out.push({ label: 'Massa gorda', value: `${metrics.fat_mass_kg.toFixed(1)} kg` });
        }
        if (typeof metrics.rcq === 'number') {
            out.push({ label: 'RCQ', value: metrics.rcq.toFixed(2) });
        }
        return out;
    }, [metrics]);

    const studentName = (session.detail?.student as { name?: string } | null)?.name ?? 'Aluno';
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const canDownloadPdf = session.detail?.session.status === 'completed';

    const handleSharePdf = async () => {
        if (isGeneratingPdf || !sessionId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsGeneratingPdf(true);
        try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            if (!authSession?.access_token) {
                throw new Error('Sessão expirada. Faça login novamente.');
            }

            const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
            if (!url) throw new Error('Configuração inválida');

            const res = await fetch(`${url}/functions/v1/generate-assessment-pdf`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authSession.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ session_id: sessionId }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'unknown' })) as { error?: string };
                const message =
                    err.error === 'forbidden' ? 'Sem permissão para gerar este laudo.'
                    : err.error === 'session_not_found' ? 'Sessão não encontrada.'
                    : 'Falha ao gerar o laudo. Tente novamente em instantes.';
                throw new Error(message);
            }

            const filename = parseFilenameFromHeader(res.headers.get('content-disposition'))
                ?? `laudo-${sessionId}.pdf`;
            const arrayBuffer = await res.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);

            const fileUri = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            if (!(await Sharing.isAvailableAsync())) {
                throw new Error('Compartilhamento não disponível neste dispositivo.');
            }
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Compartilhar laudo',
                UTI: 'com.adobe.pdf',
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Erro inesperado';
            Alert.alert('Erro', message);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    React.useEffect(() => {
        if (!session.orphaned) return;
        router.replace('/(trainer-tabs)/forms');
    }, [session.orphaned, router]);

    if (session.isLoading || session.orphaned) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator color={colors.brand.primary} />
            </View>
        );
    }
    if (!session.detail) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary, padding: 24 }}>
                <Text style={{ color: colors.text.secondary }}>Sessão não encontrada</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
            <View
                style={{
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: colors.background.card,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.primary,
                }}>
                <TouchableOpacity
                    onPress={() =>
                        router.replace({
                            pathname: '/(trainer-tabs)/forms',
                            params: { tab: 'assessments' },
                        })
                    }
                    style={{ padding: 6 }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar para Avaliações">
                    <ChevronLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: colors.text.primary }}>
                        Resultado
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                        {studentName} — {session.detail.template?.title ?? 'Avaliação'}
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 16 }}>
                {stats.length > 0 ? (
                    <ResultStatsCard stats={stats} />
                ) : (
                    <View style={{ backgroundColor: colors.background.card, borderRadius: 14, padding: 18 }}>
                        <Text style={{ color: colors.text.tertiary }}>
                            Nenhum resultado calculado para esta sessão.
                        </Text>
                    </View>
                )}

                {/* Comparativo */}
                <View style={{ gap: 8 }}>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: colors.text.tertiary,
                            textTransform: 'uppercase',
                            letterSpacing: 1.2,
                        }}>
                        Comparativo
                    </Text>
                    {comparison.isLoading ? (
                        <ActivityIndicator color={colors.brand.primary} />
                    ) : !comparison.comparison ||
                      !comparison.comparison.previousSession ? (
                        <View style={{ backgroundColor: colors.background.card, borderRadius: 14, padding: 14 }}>
                            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                                Primeira avaliação deste aluno — sem histórico para comparar.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {comparison.comparison.deltas.map((d) => (
                                <ResultComparisonRow
                                    key={d.metric_key}
                                    label={metricLabel(d.metric_key)}
                                    previous={d.previous !== null ? formatMetric(d.metric_key, d.previous) : null}
                                    current={formatMetric(d.metric_key, d.current)}
                                    delta={d.delta_absolute}
                                    delta_unit={metricUnit(d.metric_key)}
                                    lower_is_better={isLowerBetter(d.metric_key)}
                                />
                            ))}
                            {!comparison.comparison.isSameTemplate && (
                                <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 4 }}>
                                    * Comparativo cruzando templates diferentes — interpretar com cautela.
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* History sparklines */}
                <View style={{ gap: 8 }}>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: colors.text.tertiary,
                            textTransform: 'uppercase',
                            letterSpacing: 1.2,
                        }}>
                        Histórico
                    </Text>
                    {bfTimeline.points.length > 0 && (
                        <HistoryMiniChart points={bfTimeline.points} label="% Gordura" unit="%" />
                    )}
                    {bmiTimeline.points.length > 0 && (
                        <HistoryMiniChart points={bmiTimeline.points} label="IMC" unit="" />
                    )}
                    {bfTimeline.points.length === 0 && bmiTimeline.points.length === 0 && (
                        <View style={{ backgroundColor: colors.background.card, borderRadius: 14, padding: 14 }}>
                            <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>
                                Sem histórico ainda. Próximas avaliações começarão a montar a série.
                            </Text>
                        </View>
                    )}
                </View>

                {canDownloadPdf && (
                    <TouchableOpacity
                        onPress={handleSharePdf}
                        disabled={isGeneratingPdf}
                        accessibilityRole="button"
                        accessibilityLabel="Compartilhar laudo"
                        accessibilityState={{ disabled: isGeneratingPdf }}
                        style={{
                            marginTop: 4,
                            backgroundColor: colors.background.card,
                            borderRadius: 14,
                            paddingVertical: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            borderWidth: 1,
                            borderColor: colors.border.secondary,
                            opacity: isGeneratingPdf ? 0.6 : 1,
                        }}>
                        {isGeneratingPdf ? (
                            <ActivityIndicator size="small" color={colors.brand.primary} />
                        ) : (
                            <Share2 size={18} color={colors.brand.primary} />
                        )}
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.brand.primary }}>
                            {isGeneratingPdf ? 'Gerando…' : 'Compartilhar laudo (PDF)'}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

function safeBmiClass(value: number) {
    try {
        return classifyBMI(value);
    } catch {
        return null;
    }
}

function metricLabel(key: string): string {
    switch (key) {
        case 'bmi': return 'IMC';
        case 'body_fat_percent': return '% Gordura';
        case 'lean_mass_kg': return 'Massa magra';
        case 'fat_mass_kg': return 'Massa gorda';
        case 'rcq': return 'RCQ';
        case 'body_density': return 'Densidade';
        default: return key;
    }
}

function metricUnit(key: string): string {
    switch (key) {
        case 'body_fat_percent': return 'pp';
        case 'lean_mass_kg':
        case 'fat_mass_kg': return ' kg';
        case 'bmi':
        case 'rcq':
        case 'body_density': return '';
        default: return '';
    }
}

function formatMetric(key: string, value: number): string {
    switch (key) {
        case 'bmi': return value.toFixed(1);
        case 'body_fat_percent': return `${value.toFixed(1)}%`;
        case 'lean_mass_kg':
        case 'fat_mass_kg': return `${value.toFixed(1)} kg`;
        case 'rcq': return value.toFixed(2);
        case 'body_density': return value.toFixed(4);
        default: return String(value);
    }
}

function isLowerBetter(key: string): boolean {
    return key === 'body_fat_percent' || key === 'fat_mass_kg' || key === 'rcq' || key === 'bmi';
}

// Convert a binary buffer to base64 without going through Buffer (RN doesn't
// ship with `Buffer` by default and `btoa` only handles binary strings, which
// is fragile for byte sequences > 0xFF). This keeps the implementation
// dependency-free and predictable.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    // eslint-disable-next-line no-undef
    return globalThis.btoa(binary);
}
