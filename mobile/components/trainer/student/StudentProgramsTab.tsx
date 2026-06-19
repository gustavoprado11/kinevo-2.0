import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, Platform } from "react-native";
import { Calendar, Sparkles, FileText, Pencil, MoreHorizontal, Trash2, Play } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter, useFocusEffect } from "expo-router";
import { getStudentDraftSummary, removeProgramDraft, type ProgramDraftSummary } from "../../../lib/program-drafts";
import { supabase } from "../../../lib/supabase";
import { toast } from "../../../lib/toast";
import { getProgramWeek } from "@kinevo/shared/utils/schedule-projection";
import type { StudentDetailData } from "../../../hooks/useStudentDetail";
import { useV2Colors } from "../../../hooks/useV2Colors";
import { toRgba } from "../../../lib/brandColor";

interface Props {
    data: StudentDetailData;
    onRefresh?: () => Promise<void> | void;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function StudentProgramsTab({ data, onRefresh }: Props) {
    const colors = useV2Colors();
    const router = useRouter();
    const [isMutating, setIsMutating] = useState(false);

    // Rascunho de programa em andamento deste aluno (prateleira MMKV). Relido a
    // cada foco da aba para refletir saídas/descartes feitos no builder.
    const [draftSummary, setDraftSummary] = useState<ProgramDraftSummary | null>(null);
    useFocusEffect(
        useCallback(() => {
            setDraftSummary(getStudentDraftSummary(data.student.id));
        }, [data.student.id])
    );
    const handleContinueDraft = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/program-builder", params: { studentId: data.student.id, resume: "1" } } as any);
    }, [router, data.student.id]);
    const handleDiscardDraft = useCallback(() => {
        Alert.alert(
            "Descartar rascunho?",
            "O rascunho não salvo deste programa será removido.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Descartar",
                    style: "destructive",
                    onPress: () => {
                        if (draftSummary) removeProgramDraft(draftSummary.key);
                        setDraftSummary(null);
                    },
                },
            ]
        );
    }, [draftSummary]);

    const completeProgram = useCallback(async (programId: string, studentId: string) => {
        if (isMutating) return;
        setIsMutating(true);
        try {
            // Mesma fórmula do web (web/src/app/students/[id]/actions/complete-program.ts):
            // marca como completed + carimba timestamp. Trigger no banco / RLS
            // garantem ownership; o filtro por student_id é proteção em profundidade.
            const { error } = await (supabase as any)
                .from("assigned_programs")
                .update({ status: "completed", completed_at: new Date().toISOString() })
                .eq("id", programId)
                .eq("student_id", studentId);
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            toast.success("Programa concluído", "O aluno foi notificado e o programa foi movido pro histórico.");
            await onRefresh?.();
        } catch (err: any) {
            if (__DEV__) console.error("[StudentProgramsTab] complete failed:", err);
            toast.error("Erro ao concluir programa", err?.message ?? "Tente novamente em instantes.");
        } finally {
            setIsMutating(false);
        }
    }, [isMutating, onRefresh]);

    const deleteProgram = useCallback(async (programId: string, studentId: string) => {
        if (isMutating) return;
        setIsMutating(true);
        try {
            const { error } = await (supabase as any)
                .from("assigned_programs")
                .delete()
                .eq("id", programId)
                .eq("student_id", studentId);
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            toast.success("Programa excluído", "O programa e todos os treinos vinculados foram removidos.");
            await onRefresh?.();
        } catch (err: any) {
            if (__DEV__) console.error("[StudentProgramsTab] delete failed:", err);
            toast.error("Erro ao excluir programa", err?.message ?? "Tente novamente em instantes.");
        } finally {
            setIsMutating(false);
        }
    }, [isMutating, onRefresh]);

    // ── Rascunhos persistidos no banco (criados fora do builder, ex.: assistente via MCP) ──
    const activateDraft = useCallback(async (programId: string) => {
        if (isMutating) return;
        setIsMutating(true);
        try {
            // RPC atômica: valida dias agendados, encerra o programa ativo atual,
            // vira o rascunho em 'active' e notifica o aluno (inbox + realtime).
            const { error } = await (supabase as any).rpc("activate_draft_program", { p_program_id: programId });
            if (error) {
                const msg: string = error.message ?? "";
                if (msg.includes("missing_scheduled_days")) {
                    const names = msg.split("missing_scheduled_days:")[1]?.trim();
                    toast.error(
                        "Treinos sem dia agendado",
                        names ? `Agende os dias de: ${names}` : "Todo treino precisa de pelo menos um dia da semana."
                    );
                    return;
                }
                throw error;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            toast.success("Programa ativado", "O aluno foi notificado e o programa está disponível no app dele.");
            await onRefresh?.();
        } catch (err: any) {
            if (__DEV__) console.error("[StudentProgramsTab] activate draft failed:", err);
            toast.error("Erro ao ativar programa", err?.message ?? "Tente novamente em instantes.");
        } finally {
            setIsMutating(false);
        }
    }, [isMutating, onRefresh]);

    const confirmActivateDraft = useCallback((programId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        const message = data.activeProgram
            ? "Ao ativar este rascunho, o programa ativo atual será encerrado e movido pro histórico. Deseja continuar?"
            : "O programa ficará disponível no app do aluno. Deseja ativar agora?";
        Alert.alert("Ativar programa", message, [
            { text: "Cancelar", style: "cancel" },
            { text: "Ativar", onPress: () => activateDraft(programId) },
        ]);
    }, [data.activeProgram, activateDraft]);

    const confirmDiscardDraft = useCallback((programId: string, name: string) => {
        Alert.alert(
            "Descartar rascunho",
            `"${name}" e seus treinos serão removidos. Esta ação não pode ser desfeita.`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Descartar", style: "destructive", onPress: () => deleteProgram(programId, data.student.id) },
            ]
        );
    }, [deleteProgram, data.student.id]);

    // Revisar/editar o rascunho no builder (paridade com o web). Reusa a rota de
    // edição de programa atribuído: o builder carrega a árvore e, ao salvar, o
    // status 'draft' é PRESERVADO (o save só vira active/scheduled quando há data
    // de início — ver useProgramBuilder.saveAssignedProgramFull). Ativar continua
    // sendo a ação explícita; revisar não publica nada pro aluno.
    const reviewDraft = useCallback((programId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        router.push({
            pathname: "/program-builder/edit/[assignedProgramId]",
            params: { assignedProgramId: programId },
        } as any);
    }, [router]);

    const openActiveProgramMenu = useCallback(() => {
        if (!data.activeProgram) return;
        const program = data.activeProgram;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

        const confirmComplete = () =>
            Alert.alert(
                "Concluir programa",
                "Este programa será movido pro histórico. O aluno não poderá mais executar treinos dele no app. Deseja continuar?",
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Concluir", style: "default", onPress: () => completeProgram(program.id, data.student.id) },
                ],
            );

        const confirmDelete = () =>
            Alert.alert(
                "Excluir programa",
                `"${program.name}" e todos os treinos vinculados serão removidos. Esta ação não pode ser desfeita.`,
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Excluir", style: "destructive", onPress: () => deleteProgram(program.id, data.student.id) },
                ],
            );

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: program.name,
                    options: ["Cancelar", "Editar", "Concluir programa", "Excluir programa"],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: 3,
                },
                (idx) => {
                    if (idx === 1) {
                        router.push({
                            pathname: "/program-builder/edit/[assignedProgramId]",
                            params: { assignedProgramId: program.id },
                        } as any);
                    } else if (idx === 2) {
                        confirmComplete();
                    } else if (idx === 3) {
                        confirmDelete();
                    }
                },
            );
            return;
        }

        Alert.alert(program.name, undefined, [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Editar",
                onPress: () =>
                    router.push({
                        pathname: "/program-builder/edit/[assignedProgramId]",
                        params: { assignedProgramId: program.id },
                    } as any),
            },
            { text: "Concluir programa", onPress: confirmComplete },
            { text: "Excluir programa", style: "destructive", onPress: confirmDelete },
        ], { cancelable: true });
    }, [data.activeProgram, data.student.id, router, completeProgram, deleteProgram]);

    // Track which completed programs have reports
    const [reportMap, setReportMap] = useState<Record<string, string>>({});

    const completedProgramIds = data.programHistory
        .filter((p) => p.status === "completed")
        .map((p) => p.id);

    useEffect(() => {
        if (completedProgramIds.length === 0) return;
        (async () => {
            const { data: reports } = await (supabase as any)
                .from("program_reports")
                .select("id, assigned_program_id")
                .in("assigned_program_id", completedProgramIds);
            if (reports) {
                const map: Record<string, string> = {};
                for (const r of reports) map[r.assigned_program_id] = r.id;
                setReportMap(map);
            }
        })();
    }, [completedProgramIds.join(",")]);

    const handleOpenReport = useCallback(
        (reportId: string) => {
            router.push({ pathname: "/report/[id]", params: { id: reportId } } as any);
        },
        [router]
    );

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Rascunho não salvo (prateleira MMKV) — retomar montagem */}
            {draftSummary && (
                <View style={{ backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.30)", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 20 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <FileText size={16} color="#D97706" />
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary, flexShrink: 1 }} numberOfLines={1}>
                            {draftSummary.name.trim() || "Programa sem nome"}
                        </Text>
                        <View style={{ backgroundColor: "rgba(245,158,11,0.18)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706" }}>Rascunho</Text>
                        </View>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 12 }}>
                        {(draftSummary.workoutCount > 0 ? `${draftSummary.workoutCount} ${draftSummary.workoutCount === 1 ? "treino" : "treinos"} · ` : "") + "não salvo"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <TouchableOpacity
                            onPress={handleContinueDraft}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel="Continuar montando"
                            style={{ flex: 1, backgroundColor: "#F59E0B", borderRadius: 12, paddingVertical: 10, alignItems: "center" }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>Continuar montando</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleDiscardDraft}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Descartar rascunho"
                            style={{ padding: 10, borderRadius: 12 }}
                        >
                            <Trash2 size={18} color="#D97706" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Rascunhos salvos no banco (criados fora do builder, ex.: assistente via MCP).
                Diferente da prateleira MMKV acima: já são programas persistidos. Revisar
                abre o builder (preserva o status 'draft' no save); Ativar/Descartar agem
                direto. Paridade com o web. */}
            {(data.draftPrograms ?? []).map((d) => {
                const workoutCount = d.workouts.length;
                return (
                    <View
                        key={d.id}
                        style={{ backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.30)", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <FileText size={16} color="#D97706" />
                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary, flexShrink: 1 }} numberOfLines={1}>
                                {d.name}
                            </Text>
                            <View style={{ backgroundColor: "rgba(245,158,11,0.18)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706" }}>Rascunho</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 12 }}>
                            <Sparkles size={12} color={colors.text.secondary} />
                            <Text style={{ fontSize: 12, color: colors.text.secondary, flexShrink: 1 }}>
                                {(workoutCount > 0 ? `${workoutCount} ${workoutCount === 1 ? "treino" : "treinos"} · ` : "") + "criado pelo assistente · não ativado"}
                            </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => confirmActivateDraft(d.id)}
                                disabled={isMutating}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Ativar programa"
                                style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: colors.purple[600], borderRadius: 12, paddingVertical: 10, opacity: isMutating ? 0.6 : 1 }}
                            >
                                <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>Ativar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => reviewDraft(d.id)}
                                disabled={isMutating}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Revisar rascunho"
                                style={{ padding: 10, borderRadius: 12, opacity: isMutating ? 0.6 : 1 }}
                            >
                                <Pencil size={18} color={colors.text.secondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => confirmDiscardDraft(d.id, d.name)}
                                disabled={isMutating}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Descartar rascunho"
                                style={{ padding: 10, borderRadius: 12 }}
                            >
                                <Trash2 size={18} color="#D97706" />
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })}

            {/* Active Program */}
            {data.activeProgram ? (
                <>
                    <SectionLabel>Programa Ativo</SectionLabel>
                    <View style={{ backgroundColor: colors.surface.card, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                            <Text
                                style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary, flexShrink: 1 }}
                                numberOfLines={1}
                            >
                                {data.activeProgram.name}
                            </Text>
                            {/* Badges + ação de editar agrupados à direita.
                             *  Antes o "Editar programa" era um botão de
                             *  largura total no meio do card, quebrando o
                             *  fluxo entre cabeçalho e lista de treinos.
                             *  Agora vira uma pílula compacta no canto
                             *  superior direito — convenção iOS, libera o
                             *  card pra fluir título → semanas → lista. */}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                {data.activeProgram.ai_generated && (
                                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: toRgba(colors.purple[600], 0.12), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                        <Sparkles size={12} color={colors.purple[600]} />
                                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.purple[600], marginLeft: 3 }}>IA</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    onPress={() => {
                                        if (!data.activeProgram) return;
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        router.push({
                                            pathname: "/program-builder/edit/[assignedProgramId]",
                                            params: { assignedProgramId: data.activeProgram.id },
                                        } as any);
                                    }}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Editar programa"
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 4,
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: 8,
                                        backgroundColor: toRgba(colors.purple[600], 0.16),
                                    }}
                                >
                                    <Pencil size={12} color={colors.purple[700]} strokeWidth={2.5} />
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.purple[700], letterSpacing: 0.1 }}>
                                        Editar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={openActiveProgramMenu}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Mais opções do programa"
                                    disabled={isMutating}
                                    hitSlop={8}
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 8,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: colors.surface.canvas,
                                        opacity: isMutating ? 0.5 : 1,
                                    }}
                                >
                                    <MoreHorizontal size={16} color={colors.text.secondary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {data.activeProgram.description && (
                            <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 8 }}>
                                {data.activeProgram.description}
                            </Text>
                        )}

                        <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
                            {!!data.activeProgram.duration_weeks && (
                                <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                                    {data.activeProgram.duration_weeks} semanas
                                </Text>
                            )}
                            <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                                Semana {
                                    data.activeProgram.started_at
                                        ? getProgramWeek(new Date(), data.activeProgram.started_at, data.activeProgram.duration_weeks) ?? (data.activeProgram.duration_weeks || 1)
                                        : 1
                                }
                            </Text>
                        </View>

                        {/* Workouts */}
                        {data.activeProgram.workouts.map((w) => (
                            <View
                                key={w.id}
                                style={{
                                    paddingVertical: 10,
                                    borderTopWidth: 0.5,
                                    borderTopColor: "rgba(0,0,0,0.06)",
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text.primary }}>
                                    {w.name}
                                </Text>
                                {w.scheduled_days && w.scheduled_days.length > 0 && (
                                    <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 3 }}>
                                        {w.scheduled_days.map((d) => DAY_NAMES[d] || d).join(", ")}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                </>
            ) : (
                <View style={{ alignItems: "center", marginTop: 40, marginBottom: 20 }}>
                    <Calendar size={40} color="#d1d5db" />
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.tertiary, marginTop: 12 }}>
                        Nenhum programa ativo
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4, textAlign: "center" }}>
                        Atribua um programa usando o botão acima
                    </Text>
                </View>
            )}

            {/* Program History */}
            {data.programHistory.length > 0 && (
                <>
                    <SectionLabel>Histórico</SectionLabel>
                    <View style={{ backgroundColor: colors.surface.card, borderRadius: 14, overflow: "hidden" }}>
                        {data.programHistory.map((p, idx) => {
                            const reportId = reportMap[p.id];
                            return (
                                <View
                                    key={p.id}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 12,
                                        borderBottomWidth: idx < data.programHistory.length - 1 ? 0.5 : 0,
                                        borderBottomColor: "rgba(0,0,0,0.06)",
                                    }}
                                >
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text.primary }}>
                                                {p.name}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>
                                                {p.duration_weeks ? `${p.duration_weeks} semanas` : "—"}
                                                {p.completed_at && ` · Concluído em ${new Date(p.completed_at).toLocaleDateString("pt-BR")}`}
                                            </Text>
                                        </View>
                                        <View
                                            style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 3,
                                                borderRadius: 8,
                                                backgroundColor: p.status === "completed" ? "#dcfce7" : p.status === "expired" ? "#fef3c7" : "#fef3c7",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: "600",
                                                    color: p.status === "completed" ? "#16a34a" : "#d97706",
                                                }}
                                            >
                                                {p.status === "completed" ? "Concluído" : p.status === "expired" ? "Expirado" : "Pausado"}
                                            </Text>
                                        </View>
                                    </View>
                                    {reportId && (
                                        <TouchableOpacity
                                            onPress={() => handleOpenReport(reportId)}
                                            activeOpacity={0.7}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                marginTop: 8,
                                                paddingVertical: 6,
                                                paddingHorizontal: 10,
                                                backgroundColor: toRgba(colors.purple[600], 0.12),
                                                borderRadius: 8,
                                                alignSelf: "flex-start",
                                                gap: 5,
                                            }}
                                        >
                                            <FileText size={13} color={colors.purple[600]} />
                                            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.purple[600] }}>
                                                Ver relatório
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

function SectionLabel({ children }: { children: string }) {
    const colors = useV2Colors();
    return (
        <Text
            style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.text.secondary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
            }}
        >
            {children}
        </Text>
    );
}
