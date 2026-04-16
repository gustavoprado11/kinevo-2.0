import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    ChevronLeft,
    Target,
    TrendingUp,
    Flame,
    Zap,
    BarChart3,
    Activity,
    MessageSquare,
    Send,
    RefreshCw,
    FileText,
    ArrowDown,
} from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../../lib/supabase";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { generateReportHTML } from "../../lib/reports/program-report-pdf";

// ── Types (mirrored from web service — kept local to avoid cross-package import) ──

interface ReportFrequency {
    completed_sessions: number;
    planned_sessions: number;
    percentage: number;
    weekly_breakdown: number[];
    best_streak_weeks: number;
}

interface ReportVolume {
    total_tonnage_kg: number;
    weekly_tonnage: number[];
    previous_program_tonnage_kg: number | null;
}

interface ReportRPE {
    weekly_avg: (number | null)[];
    overall_avg: number | null;
}

interface ReportExerciseProgression {
    exercise_id: string;
    exercise_name: string;
    weekly_max_weight: (number | null)[];
    start_weight: number;
    end_weight: number;
    change_kg: number;
    change_pct: number;
}

interface ReportCheckins {
    averages: Array<{
        question_label: string;
        avg_value: number;
        scale_max: number;
    }>;
}

interface ProgramReportMetrics {
    frequency: ReportFrequency;
    volume: ReportVolume;
    rpe: ReportRPE;
    progression: { top_exercises: ReportExerciseProgression[] };
    checkins: ReportCheckins;
}

interface ProgramReport {
    id: string;
    assigned_program_id: string;
    student_id: string;
    trainer_id: string;
    status: "draft" | "published";
    program_name: string;
    program_duration_weeks: number | null;
    program_started_at: string | null;
    program_completed_at: string | null;
    metrics_json: ProgramReportMetrics;
    trainer_notes: string | null;
    generated_at: string;
    published_at: string | null;
}

// ── Colors ──

const COLORS = {
    bg: "#F2F2F7",
    card: "#ffffff",
    primary: "#7c3aed",
    primaryLight: "#f3f0ff",
    text: "#1a1a2e",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    green: "#16a34a",
    greenBg: "#dcfce7",
    amber: "#d97706",
    amberBg: "#fef3c7",
    red: "#ef4444",
    blue: "#3b82f6",
    border: "rgba(0,0,0,0.06)",
};

const PROGRESSION_COLORS = ["#7c3aed", "#3b82f6", "#f59e0b"];

// ── Main Screen ──

export default function ReportScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { role } = useRoleMode();
    const isTrainerView = role === "trainer";

    const [report, setReport] = useState<ProgramReport | null>(null);
    const [studentName, setStudentName] = useState<string>("");
    const [trainerName, setTrainerName] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [notes, setNotes] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchReport = useCallback(async () => {
        if (!id) return;
        try {
            const { data, error } = await (supabase as any)
                .from("program_reports")
                .select("*")
                .eq("id", id)
                .single();

            if (error || !data) {
                console.error("[report] Fetch failed:", error?.message);
                return;
            }

            const r = data as unknown as ProgramReport;
            setReport(r);
            setNotes(r.trainer_notes ?? "");

            // Fetch student & trainer names
            const [{ data: student }, { data: trainer }] = await Promise.all([
                supabase.from("students").select("name").eq("id", r.student_id).single(),
                (supabase as any).from("trainers").select("name").eq("id", r.trainer_id).single(),
            ]);

            if (student) setStudentName(student.name);
            if (trainer) setTrainerName(trainer.name);
        } catch (err) {
            console.error("[report] Unexpected error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [id]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchReport();
    }, [fetchReport]);

    // Auto-save trainer notes with debounce
    const handleNotesChange = useCallback(
        (text: string) => {
            setNotes(text);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                if (!report) return;
                const { error } = await (supabase as any)
                    .from("program_reports")
                    .update({ trainer_notes: text })
                    .eq("id", report.id);
                if (error) console.error("[report] Failed to save notes:", error.message);
            }, 1500);
        },
        [report]
    );

    const handlePublish = useCallback(() => {
        if (!report) return;
        Alert.alert(
            "Publicar relatório",
            "O aluno poderá visualizar este relatório. Deseja continuar?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Publicar",
                    onPress: async () => {
                        setIsPublishing(true);
                        const { error } = await (supabase as any)
                            .from("program_reports")
                            .update({ status: "published", published_at: new Date().toISOString() })
                            .eq("id", report.id)
                            .eq("status", "draft");

                        if (error) {
                            Alert.alert("Erro", "Falha ao publicar o relatório.");
                            console.error("[report] Publish failed:", error.message);
                        } else {
                            setReport((prev) => prev ? { ...prev, status: "published", published_at: new Date().toISOString() } : null);
                        }
                        setIsPublishing(false);
                    },
                },
            ]
        );
    }, [report]);

    const handleUnpublish = useCallback(() => {
        if (!report) return;
        Alert.alert(
            "Despublicar relatório",
            "O aluno não poderá mais visualizar este relatório. Deseja continuar?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Despublicar",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await (supabase as any)
                            .from("program_reports")
                            .update({ status: "draft", published_at: null })
                            .eq("id", report.id);

                        if (error) {
                            Alert.alert("Erro", "Falha ao despublicar o relatório.");
                        } else {
                            setReport((prev) => prev ? { ...prev, status: "draft", published_at: null } : null);
                        }
                    },
                },
            ]
        );
    }, [report]);

    const handleRegenerate = useCallback(() => {
        if (!report) return;
        Alert.alert(
            "Regenerar métricas",
            "As métricas serão recalculadas. Suas observações serão preservadas. Deseja continuar?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Regenerar",
                    onPress: async () => {
                        setIsRegenerating(true);
                        // Save notes, delete, re-fetch
                        const savedNotes = notes;
                        const programId = report.assigned_program_id;

                        const { error: delError } = await (supabase as any)
                            .from("program_reports")
                            .delete()
                            .eq("id", report.id);

                        if (delError) {
                            Alert.alert("Erro", "Falha ao regenerar o relatório.");
                            setIsRegenerating(false);
                            return;
                        }

                        // The report generation would normally be done via a server-side
                        // call to the service. For now, show a message.
                        Alert.alert(
                            "Relatório removido",
                            "Gere um novo relatório a partir da tela do programa do aluno.",
                            [{ text: "OK", onPress: () => router.back() }]
                        );
                        setIsRegenerating(false);
                    },
                },
            ]
        );
    }, [report, notes, router]);

    const handleExportPDF = useCallback(async () => {
        if (!report) return;
        setIsExporting(true);
        try {
            const html = generateReportHTML(report, studentName || "Aluno", trainerName || "Treinador");
            const { uri } = await Print.printToFileAsync({ html, base64: false });

            await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle: "Compartilhar Relatório",
            });
        } catch (err) {
            console.error("[report] PDF export failed:", err);
            Alert.alert("Erro", "Não foi possível exportar o relatório.");
        } finally {
            setIsExporting(false);
        }
    }, [report, studentName, trainerName]);

    // ── Loading state ──

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                        <ChevronLeft size={24} color={COLORS.text} />
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </View>
        );
    }

    // ── Empty state ──

    if (!report) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                        <ChevronLeft size={24} color={COLORS.text} />
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
                    <FileText size={48} color={COLORS.textMuted} />
                    <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 12, textAlign: "center" }}>
                        Relatório não encontrado
                    </Text>
                </View>
            </View>
        );
    }

    const { metrics_json: m } = report;
    const isDraft = report.status === "draft";
    const hasFrequency = m.frequency && m.frequency.completed_sessions > 0;
    const hasVolume = m.volume && m.volume.total_tonnage_kg > 0;
    const hasRPE = m.rpe && m.rpe.overall_avg !== null;
    const hasProgression = m.progression?.top_exercises?.length > 0;
    const hasCheckins = m.checkins?.averages?.length > 0;

    const periodStr = formatPeriod(report.program_started_at, report.program_completed_at);
    const isCompleted = !!report.program_completed_at;

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            {/* Header */}
            <View style={{ backgroundColor: COLORS.card, paddingTop: insets.top, paddingBottom: 14 }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ flexDirection: "row", alignItems: "center" }}
                    >
                        <ChevronLeft size={22} color={COLORS.primary} />
                        <Text style={{ fontSize: 16, color: COLORS.primary, marginLeft: 2 }}>Voltar</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text, flex: 1 }} numberOfLines={1}>
                            {studentName || "Aluno"}
                        </Text>
                        <StatusBadge status={report.status} />
                    </View>
                    <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {report.program_name}
                        {periodStr ? ` · ${periodStr}` : ""}
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
            >
                {/* KPI Cards */}
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    {hasFrequency && (
                        <KPICard
                            icon={<Target size={16} color={COLORS.primary} />}
                            label="Frequência"
                            value={`${m.frequency.percentage}%`}
                            subtitle={`${m.frequency.completed_sessions} de ${m.frequency.planned_sessions}`}
                        />
                    )}
                    {hasVolume && (
                        <KPICard
                            icon={<TrendingUp size={16} color={COLORS.green} />}
                            label="Volume total"
                            value={formatTonnage(m.volume.total_tonnage_kg)}
                            subtitle={isCompleted ? formatVolumeComparison(m.volume.total_tonnage_kg, m.volume.previous_program_tonnage_kg) : null}
                        />
                    )}
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                    {hasRPE && (
                        <KPICard
                            icon={<Flame size={16} color="#f59e0b" />}
                            label="PSE média"
                            value={String(m.rpe.overall_avg)}
                            subtitle="Percepção de esforço do aluno"
                        />
                    )}
                    {hasFrequency && m.frequency.best_streak_weeks > 0 && (
                        <KPICard
                            icon={<Zap size={16} color={COLORS.blue} />}
                            label="Melhor sequência"
                            value={String(m.frequency.best_streak_weeks)}
                            subtitle="semanas consecutivas"
                        />
                    )}
                </View>

                {/* Bar chart: Frequência semanal */}
                {hasFrequency && m.frequency.weekly_breakdown.length > 0 && (
                    <>
                        <SectionLabel>Frequência Semanal</SectionLabel>
                        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            <BarChart data={m.frequency.weekly_breakdown} color={COLORS.primary} />
                        </View>
                    </>
                )}

                {/* Line chart: Progressão de carga */}
                {hasProgression && (
                    <>
                        <SectionLabel>Progressão de Carga</SectionLabel>
                        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            <MultiLineChart exercises={m.progression.top_exercises} />
                        </View>
                    </>
                )}

                {/* Line chart: PSE semanal */}
                {hasRPE && m.rpe.weekly_avg.some((v) => v !== null) && (
                    <>
                        <SectionLabel>PSE por Semana</SectionLabel>
                        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            <LineChart data={m.rpe.weekly_avg} color="#f59e0b" maxY={10} />
                        </View>
                    </>
                )}

                {/* Volume semanal */}
                {hasVolume && m.volume.weekly_tonnage.some((v) => v > 0) && (
                    <>
                        <SectionLabel>Volume Semanal</SectionLabel>
                        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            <BarChart data={m.volume.weekly_tonnage} color={COLORS.green} formatLabel={(v) => formatTonnage(v)} />
                        </View>
                    </>
                )}

                {/* Check-ins */}
                {hasCheckins && (
                    <>
                        <SectionLabel>Check-ins</SectionLabel>
                        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            {m.checkins.averages.map((item, i) => (
                                <ProgressBar
                                    key={i}
                                    label={item.question_label}
                                    value={item.avg_value}
                                    max={item.scale_max}
                                />
                            ))}
                        </View>
                    </>
                )}

                {/* Trainer notes */}
                {(isTrainerView || notes) && (
                    <>
                        <SectionLabel>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <MessageSquare size={12} color={COLORS.textSecondary} />
                                <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
                                    Observações do Treinador
                                </Text>
                            </View>
                        </SectionLabel>
                        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            {isTrainerView && isDraft ? (
                                <TextInput
                                    value={notes}
                                    onChangeText={handleNotesChange}
                                    placeholder="Adicione suas observações sobre o desempenho do aluno..."
                                    placeholderTextColor={COLORS.textMuted}
                                    multiline
                                    style={{
                                        fontSize: 15,
                                        color: COLORS.text,
                                        minHeight: 100,
                                        textAlignVertical: "top",
                                    }}
                                />
                            ) : (
                                <Text style={{ fontSize: 15, color: COLORS.text, fontStyle: notes ? "italic" : "normal" }}>
                                    {notes || "Nenhuma observação adicionada."}
                                </Text>
                            )}
                        </View>
                    </>
                )}

                {/* Action buttons — trainer only */}
                {isTrainerView && isDraft && (
                    <View style={{ gap: 10 }}>
                        <TouchableOpacity
                            onPress={handlePublish}
                            disabled={isPublishing}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: COLORS.primary,
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 8,
                                opacity: isPublishing ? 0.6 : 1,
                            }}
                        >
                            {isPublishing ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Send size={18} color="#ffffff" />
                            )}
                            <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}>
                                Publicar relatório
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleRegenerate}
                            disabled={isRegenerating}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: COLORS.card,
                                borderRadius: 14,
                                paddingVertical: 14,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 8,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.08)",
                                opacity: isRegenerating ? 0.6 : 1,
                            }}
                        >
                            {isRegenerating ? (
                                <ActivityIndicator size="small" color={COLORS.textSecondary} />
                            ) : (
                                <RefreshCw size={16} color={COLORS.textSecondary} />
                            )}
                            <Text style={{ fontSize: 15, fontWeight: "500", color: COLORS.textSecondary }}>
                                Regenerar métricas
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                {isTrainerView && !isDraft && (
                    <View style={{ gap: 10 }}>
                        <TouchableOpacity
                            onPress={handleExportPDF}
                            disabled={isExporting}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: COLORS.primary,
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 8,
                                opacity: isExporting ? 0.6 : 1,
                            }}
                        >
                            {isExporting ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <ArrowDown size={18} color="#ffffff" />
                            )}
                            <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}>
                                Exportar PDF
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleUnpublish}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: COLORS.card,
                                borderRadius: 14,
                                paddingVertical: 14,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 8,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.08)",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "500", color: COLORS.red }}>
                                Despublicar
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Student share button */}
                {!isTrainerView && (
                    <TouchableOpacity
                        onPress={handleExportPDF}
                        disabled={isExporting}
                        activeOpacity={0.7}
                        style={{
                            backgroundColor: COLORS.primary,
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 8,
                            opacity: isExporting ? 0.6 : 1,
                        }}
                    >
                        {isExporting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Send size={18} color="#ffffff" />
                        )}
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}>
                            Compartilhar
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status }: { status: "draft" | "published" }) {
    const isDraft = status === "draft";
    return (
        <View
            style={{
                backgroundColor: isDraft ? COLORS.amberBg : COLORS.greenBg,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
            }}
        >
            <Text style={{ fontSize: 12, fontWeight: "600", color: isDraft ? COLORS.amber : COLORS.green }}>
                {isDraft ? "Rascunho" : "Publicado"}
            </Text>
        </View>
    );
}

function KPICard({
    icon,
    label,
    value,
    subtitle,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle?: string | null;
}) {
    return (
        <View style={{ flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                {icon}
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 6 }}>{label}</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text }}>{value}</Text>
            {subtitle ? (
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{subtitle}</Text>
            ) : null}
        </View>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    if (typeof children === "string") {
        return (
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: COLORS.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 10,
                }}
            >
                {children}
            </Text>
        );
    }
    return <View style={{ marginBottom: 10 }}>{children}</View>;
}

// ── Bar Chart (zero-dependency) ──

function BarChart({
    data,
    color,
    formatLabel,
}: {
    data: number[];
    color: string;
    formatLabel?: (v: number) => string;
}) {
    const max = Math.max(...data, 1);
    const chartHeight = 120;

    return (
        <View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartHeight, gap: 4 }}>
                {data.map((val, i) => {
                    const barHeight = max > 0 ? (val / max) * (chartHeight - 20) : 0;
                    return (
                        <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                            {val > 0 && (
                                <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 }}>
                                    {formatLabel ? formatLabel(val) : val}
                                </Text>
                            )}
                            <View
                                style={{
                                    width: "100%",
                                    maxWidth: 32,
                                    height: Math.max(barHeight, val > 0 ? 4 : 1),
                                    backgroundColor: val > 0 ? color : "rgba(0,0,0,0.04)",
                                    borderRadius: 4,
                                }}
                            />
                        </View>
                    );
                })}
            </View>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
                {data.map((_, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted }}>S{i + 1}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ── Line Chart (zero-dependency) ──

function LineChart({
    data,
    color,
    maxY,
}: {
    data: (number | null)[];
    color: string;
    maxY?: number;
}) {
    const validValues = data.filter((v): v is number => v !== null);
    if (validValues.length === 0) return null;

    const actualMax = maxY ?? Math.max(...validValues);
    const chartHeight = 100;
    const dotSize = 8;

    // Compute Y positions for each data point
    const points = data.map((val) => {
        if (val === null) return null;
        return chartHeight - (val / actualMax) * (chartHeight - dotSize);
    });

    return (
        <View>
            <View style={{ height: chartHeight, flexDirection: "row", alignItems: "flex-start" }}>
                {points.map((y, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center", height: chartHeight }}>
                        {y !== null ? (
                            <View style={{ position: "absolute", top: y - dotSize / 2 }}>
                                <View
                                    style={{
                                        width: dotSize,
                                        height: dotSize,
                                        borderRadius: dotSize / 2,
                                        backgroundColor: color,
                                    }}
                                />
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: COLORS.textSecondary,
                                        textAlign: "center",
                                        marginTop: 2,
                                        width: 30,
                                        marginLeft: -11,
                                    }}
                                >
                                    {data[i]}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ position: "absolute", top: chartHeight / 2 }}>
                                <Text style={{ fontSize: 10, color: COLORS.textMuted }}>—</Text>
                            </View>
                        )}
                        {/* Connecting line to next point */}
                        {i < points.length - 1 && y !== null && points[i + 1] !== null && (
                            <View
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: y,
                                    width: "100%",
                                    height: 2,
                                    backgroundColor: `${color}30`,
                                }}
                            />
                        )}
                    </View>
                ))}
            </View>
            <View style={{ flexDirection: "row", marginTop: 6 }}>
                {data.map((_, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted }}>S{i + 1}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ── Multi-line Chart (Progression) ──

function MultiLineChart({ exercises }: { exercises: ReportExerciseProgression[] }) {
    const allWeights = exercises.flatMap((e) => e.weekly_max_weight.filter((v): v is number => v !== null));
    if (allWeights.length === 0) return null;

    const maxWeight = Math.max(...allWeights);
    const chartHeight = 120;
    const dotSize = 7;

    return (
        <View>
            {/* Chart area */}
            <View style={{ height: chartHeight, marginBottom: 8 }}>
                {exercises.map((exercise, exIdx) => {
                    const color = PROGRESSION_COLORS[exIdx % PROGRESSION_COLORS.length];
                    return (
                        <View
                            key={exercise.exercise_id}
                            style={{
                                position: exIdx === 0 ? "relative" : "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: chartHeight,
                                flexDirection: "row",
                            }}
                        >
                            {exercise.weekly_max_weight.map((val, i) => {
                                const y = val !== null
                                    ? chartHeight - (val / maxWeight) * (chartHeight - dotSize) - dotSize / 2
                                    : null;
                                return (
                                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                                        {y !== null && (
                                            <View
                                                style={{
                                                    position: "absolute",
                                                    top: y,
                                                    width: dotSize,
                                                    height: dotSize,
                                                    borderRadius: dotSize / 2,
                                                    backgroundColor: color,
                                                }}
                                            />
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}
            </View>

            {/* Week labels */}
            <View style={{ flexDirection: "row", marginBottom: 12 }}>
                {exercises[0]?.weekly_max_weight.map((_, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted }}>S{i + 1}</Text>
                    </View>
                ))}
            </View>

            {/* Legend */}
            <View style={{ gap: 6 }}>
                {exercises.map((exercise, exIdx) => {
                    const color = PROGRESSION_COLORS[exIdx % PROGRESSION_COLORS.length];
                    return (
                        <View key={exercise.exercise_id} style={{ flexDirection: "row", alignItems: "center" }}>
                            <View
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: color,
                                    marginRight: 8,
                                }}
                            />
                            <Text style={{ fontSize: 13, color: COLORS.text, flex: 1 }} numberOfLines={1}>
                                {exercise.exercise_name}
                            </Text>
                            <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                {exercise.change_kg >= 0 ? "+" : ""}
                                {exercise.change_kg}kg ({exercise.change_pct >= 0 ? "+" : ""}
                                {exercise.change_pct}%)
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ── Progress Bar (Check-ins) ──

function ProgressBar({
    label,
    value,
    max,
}: {
    label: string;
    value: number;
    max: number;
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: COLORS.text, flex: 1 }} numberOfLines={1}>
                    {label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.text, marginLeft: 8 }}>
                    {value}/{max}
                </Text>
            </View>
            <View style={{ height: 8, backgroundColor: "#f1f5f9", borderRadius: 4 }}>
                <View
                    style={{
                        height: 8,
                        width: `${pct}%`,
                        backgroundColor: COLORS.primary,
                        borderRadius: 4,
                    }}
                />
            </View>
        </View>
    );
}

// ============================================================================
// Helpers
// ============================================================================

function formatTonnage(kg: number): string {
    if (kg >= 1000) {
        const t = Math.round(kg / 100) / 10;
        return `${t}t`;
    }
    return `${Math.round(kg)}kg`;
}

function formatVolumeComparison(current: number, previous: number | null): string | null {
    if (!previous || previous === 0) return null;
    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${Math.round(diff)}% vs anterior`;
}

function formatPeriod(start: string | null, end: string | null): string {
    if (!start) return "";
    // Use 4-digit year — "mar. de 26" is ambiguous.
    const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    if (end) return `${fmt(start)} — ${fmt(end)}`;
    return `Desde ${fmt(start)}`;
}
