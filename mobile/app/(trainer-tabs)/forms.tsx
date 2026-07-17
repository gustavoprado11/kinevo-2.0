import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
    View,
    Text,
    FlatList,
    SectionList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, ClipboardList, FileText, Plus } from "lucide-react-native";
import { v2 } from "@kinevo/shared/tokens";
import { KSegmented, KSkeletonRow } from "../../components/v2";
import { useV2Colors } from "../../hooks/useV2Colors";

const v2Tokens = v2;
import { EmptyState } from "../../components/shared/EmptyState";
import { useTrainerFormTemplates, FormTemplate } from "../../hooks/useTrainerFormTemplates";
import {
    useTrainerFormSubmissions,
    FormSubmission,
    SubmissionFilter,
} from "../../hooks/useTrainerFormSubmissions";
import { useFormTemplateCrud } from "../../hooks/useFormTemplateCrud";
import { FormTemplateCard } from "../../components/trainer/forms/FormTemplateCard";
import { SubmissionCard } from "../../components/trainer/forms/SubmissionCard";
import { AssignFormModal } from "../../components/trainer/forms/AssignFormModal";
import { SubmissionDetailSheet } from "../../components/trainer/forms/SubmissionDetailSheet";
import { FormBuilderModal, type EditingTemplate } from "../../components/trainer/forms/FormBuilderModal";
import { colors } from "@/theme";
import { useResponsive } from "../../hooks/useResponsive";
import { toast } from "../../lib/toast";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAssessmentSessions, type SessionsFilter } from "../../hooks/useAssessmentSessions";
import { useTrainerAssessmentTemplates, type TrainerAssessmentTemplate } from "../../hooks/useTrainerAssessmentTemplates";
import { SessionListItem } from "../../components/trainer/assessments/SessionListItem";
import { CreateSessionModal } from "../../components/trainer/assessments/CreateSessionModal";
import { AssessmentTemplateCard } from "../../components/trainer/assessments/AssessmentTemplateCard";
import type { AssessmentSessionListItem } from "@kinevo/shared/types/assessments";
import type { AssessmentDraft } from "../../stores/assessmentDraftStore";
import { useAssessmentOnboardingStore } from "../../stores/assessmentOnboardingStore";
import { useFormsTabStateStore, type FormsSegment } from "../../stores/formsTabStateStore";
import { MigrationBannerMobile } from "../../components/trainer/forms/MigrationBannerMobile";

// M11 — IA cleanup. 2 segmentos de top-level (formularios | avaliacoes), cada
// um com 2 sub-tabs próprias.
//   - segment formularios: subTab in {responses, templates}
//   - segment avaliacoes:  subTab in {sessions, a_templates}
// Deep-link `?tab=…` é mantido pra compat (result screen back nav) e mapeado
// pra (segment, subTab) no useEffect.
type FormsSubTab = "responses" | "templates";
type AvaliacoesSubTab = "sessions" | "a_templates";

const FILTER_CHIPS: { key: SubmissionFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendentes" },
    { key: "completed", label: "Concluídas" },
];

const ASSESSMENT_FILTER_CHIPS: { key: SessionsFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "overdue", label: "Em atraso" },
    { key: "upcoming", label: "Próximas" },
    { key: "completed", label: "Concluídas" },
];

export default function FormsScreen() {
    const dynColors = useV2Colors();
    const insets = useSafeAreaInsets();
    const { isTablet } = useResponsive();
    const router = useRouter();

    // M11 — segment ativo persiste em MMKV. Sub-tabs são locais por segmento.
    const activeSegment = useFormsTabStateStore((s) => s.activeSegment);
    const setActiveSegment = useFormsTabStateStore((s) => s.setActiveSegment);
    const [formsSubTab, setFormsSubTab] = useState<FormsSubTab>("responses");
    const [avaliacoesSubTab, setAvaliacoesSubTab] = useState<AvaliacoesSubTab>("sessions");

    // Convenience derived values — usados em filter chips, FAB, content render.
    const isResponses = activeSegment === "formularios" && formsSubTab === "responses";
    const isFormTemplates = activeSegment === "formularios" && formsSubTab === "templates";
    const isSessions = activeSegment === "avaliacoes" && avaliacoesSubTab === "sessions";
    const isAssessmentTemplates = activeSegment === "avaliacoes" && avaliacoesSubTab === "a_templates";

    // Deep-link `?tab=…` mapeado pra (segment, subTab). Usado pelo back nav do
    // result screen (que vai pra ?tab=assessments).
    const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
    useEffect(() => {
        if (!tabParam) return;
        if (tabParam === "assessments") {
            setActiveSegment("avaliacoes");
            setAvaliacoesSubTab("sessions");
        } else if (tabParam === "templates") {
            setActiveSegment("formularios");
            setFormsSubTab("templates");
        } else if (tabParam === "responses") {
            setActiveSegment("formularios");
            setFormsSubTab("responses");
        }
    }, [tabParam, setActiveSegment]);

    // Data
    const templates = useTrainerFormTemplates();
    const submissions = useTrainerFormSubmissions();
    const assessments = useAssessmentSessions();
    const assessmentTemplates = useTrainerAssessmentTemplates();

    // CRUD
    const crud = useFormTemplateCrud(() => {
        templates.refresh();
    });

    // Modals
    const [assignTemplate, setAssignTemplate] = useState<FormTemplate | null>(null);
    const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);
    const [builderVisible, setBuilderVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);
    const [createSessionVisible, setCreateSessionVisible] = useState(false);

    const handleAssign = useCallback((t: FormTemplate) => setAssignTemplate(t), []);
    const handleSubmissionPress = useCallback((s: FormSubmission) => setDetailSubmissionId(s.id), []);
    const handleSessionPress = useCallback(
        (sessionId: string) => {
            router.push({ pathname: "/assessments/[sessionId]", params: { sessionId } });
        },
        [router],
    );

    const handleRefresh = useCallback(() => {
        if (isResponses) submissions.refresh();
        else if (isFormTemplates) templates.refresh();
        else if (isSessions) assessments.refresh();
        else if (isAssessmentTemplates) assessmentTemplates.refresh();
    }, [isResponses, isFormTemplates, isSessions, isAssessmentTemplates, submissions, templates, assessments, assessmentTemplates]);

    const isRefreshing =
        isResponses
            ? submissions.isRefreshing
            : isFormTemplates
                ? templates.isRefreshing
                : isSessions
                    ? assessments.isRefreshing
                    : isAssessmentTemplates
                        ? assessmentTemplates.isRefreshing
                        : false;
    const isLoading =
        isResponses
            ? submissions.isLoading
            : isFormTemplates
                ? templates.isLoading
                : isSessions
                    ? assessments.isLoading
                    : isAssessmentTemplates
                        ? assessmentTemplates.isLoading
                        : false;

    const draftCount = assessments.inProgressDrafts.length;
    const isAssessmentsEmpty =
        assessments.inProgressDrafts.length === 0 && assessments.sessions.length === 0;

    // Builder handlers
    const handleCreateNew = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setEditingTemplate(null);
        setBuilderVisible(true);
    }, []);

    const handleCreateAssessmentSession = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCreateSessionVisible(true);
    }, []);

    // M11/B2 — tap em assessment template card → drill-down pra edit.
    const handleAssessmentTemplatePress = useCallback(
        (template: TrainerAssessmentTemplate) => {
            router.push({
                pathname: "/assessments/templates/new",
                params: { id: template.id },
            });
        },
        [router],
    );

    const handleEdit = useCallback(
        async (t: FormTemplate) => {
            try {
                const full = await crud.fetchTemplateSchema(t.id);
                setEditingTemplate(full);
                setBuilderVisible(true);
            } catch {
                toast.error("Erro ao carregar template");
            }
        },
        [crud],
    );

    const handleDelete = useCallback(
        (t: FormTemplate) => {
            Alert.alert("Excluir template", `Deseja excluir "${t.title}"? Esta ação não pode ser desfeita.`, [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await crud.deleteTemplate(t.id);
                            toast.success("Template excluído");
                        } catch {
                            toast.error("Erro ao excluir template");
                        }
                    },
                },
            ]);
        },
        [crud],
    );

    const handleSaveBuilder = useCallback(
        async (data: Parameters<typeof crud.createTemplate>[0] & { templateId?: string }) => {
            try {
                if (data.templateId) {
                    await crud.updateTemplate({ ...data, templateId: data.templateId });
                    toast.success("Template atualizado");
                } else {
                    await crud.createTemplate(data);
                    toast.success("Template criado");
                }
                setBuilderVisible(false);
                setEditingTemplate(null);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Erro ao salvar";
                toast.error(message);
            }
        },
        [crud],
    );

    const handleCloseBuilder = useCallback(() => {
        setBuilderVisible(false);
        setEditingTemplate(null);
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: dynColors.surface.canvas, paddingTop: insets.top }}>
            {/* Header */}
            <View style={{ paddingHorizontal: v2Tokens.spacing[5], paddingTop: v2Tokens.spacing[4], paddingBottom: v2Tokens.spacing[2] }}>
                <Text
                    style={{
                        fontFamily: "MonaSans_800ExtraBold",
                        fontSize: v2Tokens.typography.display.size,
                        lineHeight: v2Tokens.typography.display.lineHeight,
                        letterSpacing: v2Tokens.typography.display.letterSpacing,
                        color: dynColors.text.primary,
                    }}
                >
                    Formulários
                </Text>
                <Text
                    style={{
                        fontFamily: "MonaSans_500Medium",
                        fontSize: v2Tokens.typography.bodySm.size,
                        color: dynColors.text.tertiary,
                        marginTop: v2Tokens.spacing[1],
                    }}
                >
                    {submissions.counts.pending} pendente{submissions.counts.pending === 1 ? "" : "s"} · {submissions.counts.completed} respondida{submissions.counts.completed === 1 ? "" : "s"}
                </Text>
            </View>

            {/* M11 — Banner in-app de migração (1ª visita pós-deploy). */}
            <MigrationBannerMobile />

            {/* M11 — Segmented control (top-level). KSegmented V2. */}
            <View style={{ paddingHorizontal: v2Tokens.spacing[5], marginBottom: v2Tokens.spacing[3] }}>
                <KSegmented<"formularios" | "avaliacoes">
                    value={activeSegment}
                    onChange={(seg) => {
                        Haptics.selectionAsync();
                        setActiveSegment(seg);
                    }}
                    items={[
                        { value: "formularios", label: "Formulários" },
                        { value: "avaliacoes", label: "Avaliações", count: draftCount > 0 ? draftCount : undefined },
                    ]}
                    accessibilityLabel="Segmento de formulários"
                />
            </View>

            {/* M11 — Sub-tabs por segmento. KSegmented secundário. */}
            <View style={{ paddingHorizontal: v2Tokens.spacing[5], marginBottom: v2Tokens.spacing[3] }}>
                {activeSegment === "formularios" ? (
                    <KSegmented<FormsSubTab>
                        value={formsSubTab}
                        onChange={setFormsSubTab}
                        items={[
                            { value: "responses", label: "Respostas", count: submissions.counts.pending > 0 ? submissions.counts.pending : undefined },
                            { value: "templates", label: "Templates" },
                        ]}
                        accessibilityLabel="Sub-tab de formulários"
                    />
                ) : (
                    <KSegmented<AvaliacoesSubTab>
                        value={avaliacoesSubTab}
                        onChange={setAvaliacoesSubTab}
                        items={[
                            { value: "sessions", label: "Sessões", count: draftCount > 0 ? draftCount : undefined },
                            { value: "a_templates", label: "Templates" },
                        ]}
                        accessibilityLabel="Sub-tab de avaliações"
                    />
                )}
            </View>

            {/* Filter chips → KSegmented terciário */}
            {isResponses && (
                <View style={{ paddingHorizontal: v2Tokens.spacing[5], marginBottom: v2Tokens.spacing[2] }}>
                    <KSegmented<typeof FILTER_CHIPS[number]["key"]>
                        value={submissions.filter}
                        onChange={submissions.setFilter}
                        items={FILTER_CHIPS.map((chip) => ({
                            value: chip.key,
                            label: chip.label,
                            count: submissions.counts[chip.key] > 0 ? submissions.counts[chip.key] : undefined,
                        }))}
                        accessibilityLabel="Filtro de respostas"
                    />
                </View>
            )}
            {isSessions && (
                <View style={{ paddingHorizontal: v2Tokens.spacing[5], marginBottom: v2Tokens.spacing[2] }}>
                    <KSegmented<typeof ASSESSMENT_FILTER_CHIPS[number]["key"]>
                        value={assessments.filter}
                        onChange={assessments.setFilter}
                        items={ASSESSMENT_FILTER_CHIPS.map((chip) => ({
                            value: chip.key,
                            label: chip.label,
                            count: assessments.counts[chip.key] > 0 ? assessments.counts[chip.key] : undefined,
                        }))}
                        accessibilityLabel="Filtro de avaliações"
                    />
                </View>
            )}

            {/* Content */}
            {isLoading ? (
                <View style={{ paddingHorizontal: v2Tokens.spacing[5], gap: v2Tokens.spacing[2], marginTop: v2Tokens.spacing[2] }}>
                    <KSkeletonRow />
                    <KSkeletonRow />
                    <KSkeletonRow />
                    <KSkeletonRow />
                    <KSkeletonRow />
                </View>
            ) : isResponses ? (
                <FlatList
                    key={isTablet ? "submissions-2col" : "submissions-1col"}
                    data={submissions.submissions}
                    keyExtractor={(item) => item.id}
                    numColumns={isTablet ? 2 : 1}
                    columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: isTablet ? 40 : insets.bottom + 80,
                        gap: 10,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={dynColors.brand.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={isTablet ? { flex: 1 } : undefined}>
                            <SubmissionCard submission={item} onPress={handleSubmissionPress} />
                        </View>
                    )}
                    ListEmptyComponent={
                        <EmptyState
                            icon={<ClipboardList size={40} color={colors.text.quaternary} />}
                            title="Nenhuma resposta recebida"
                            description="Envie formulários para seus alunos para ver as respostas aqui"
                        />
                    }
                />
            ) : isFormTemplates ? (
                <FlatList
                    key={isTablet ? "templates-2col" : "templates-1col"}
                    data={templates.templates}
                    keyExtractor={(item) => item.id}
                    numColumns={isTablet ? 2 : 1}
                    columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: isTablet ? 40 : insets.bottom + 100,
                        gap: 10,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={dynColors.brand.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={isTablet ? { flex: 1 } : undefined}>
                            <FormTemplateCard
                                template={item}
                                onAssign={handleAssign}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </View>
                    )}
                    ListEmptyComponent={
                        <EmptyState
                            icon={<FileText size={40} color={colors.text.quaternary} />}
                            title="Nenhum template"
                            description="Toque no + para criar seu primeiro template de formulário"
                        />
                    }
                />
            ) : isSessions ? (
                <AssessmentsList
                    drafts={assessments.inProgressDrafts}
                    sessions={assessments.sessions}
                    isRefreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    onPressSession={handleSessionPress}
                    onCreateNew={handleCreateAssessmentSession}
                    paddingBottom={insets.bottom + 100}
                />
            ) : (
                /* M11/B2 — sub-tab "Templates" do segment Avaliações.
                   Lista templates Kinevo (5 system) + customs do trainer. */
                <FlatList
                    key={isTablet ? "atemplates-2col" : "atemplates-1col"}
                    data={assessmentTemplates.templates}
                    keyExtractor={(item) => item.id}
                    numColumns={isTablet ? 2 : 1}
                    columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: isTablet ? 40 : insets.bottom + 100,
                        gap: 10,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={dynColors.brand.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={isTablet ? { flex: 1 } : undefined}>
                            <AssessmentTemplateCard
                                template={item}
                                onPress={handleAssessmentTemplatePress}
                            />
                        </View>
                    )}
                    ListEmptyComponent={
                        <EmptyState
                            icon={<Activity size={40} color={colors.text.quaternary} />}
                            title="Nenhum template de avaliação"
                            description="Toque no + para criar seu primeiro template de avaliação."
                        />
                    }
                />
            )}

            {/* M11 — FAB V2 matrix por (segment, subTab). Hidden em Respostas
                (não há ação default) e em Sessões quando lista vazia (o
                EmptyState exibe um CTA "+ Nova avaliação" próprio). */}
            {(() => {
                let fabConfig: { onPress: () => void; label: string } | null = null;
                if (isFormTemplates) {
                    fabConfig = {
                        onPress: handleCreateNew,
                        label: "Criar novo template de formulário",
                    };
                } else if (isSessions && !isAssessmentsEmpty) {
                    fabConfig = {
                        onPress: handleCreateAssessmentSession,
                        label: "Nova avaliação",
                    };
                } else if (isAssessmentTemplates) {
                    fabConfig = {
                        onPress: () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            router.push("/assessments/templates/new");
                        },
                        label: "Novo template de avaliação",
                    };
                }
                if (!fabConfig) return null;
                return (
                    <Pressable
                        onPress={fabConfig.onPress}
                        accessibilityLabel={fabConfig.label}
                        accessibilityRole="button"
                        style={{
                            position: "absolute",
                            right: v2Tokens.spacing[5],
                            bottom: insets.bottom + 90,
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            overflow: "hidden",
                            shadowColor: v2Tokens.colors.purple[600],
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.32,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <LinearGradient
                            colors={[v2Tokens.colors.purple[600], v2Tokens.colors.purple[700]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                        >
                            <Plus size={26} color="#ffffff" strokeWidth={2.5} />
                        </LinearGradient>
                    </Pressable>
                );
            })()}

            {/* Modals */}
            <AssignFormModal
                visible={!!assignTemplate}
                template={assignTemplate}
                onClose={() => setAssignTemplate(null)}
                onSuccess={() => {
                    submissions.refresh();
                    templates.refresh();
                }}
            />

            <SubmissionDetailSheet
                visible={!!detailSubmissionId}
                submissionId={detailSubmissionId}
                onClose={() => setDetailSubmissionId(null)}
                onFeedbackSent={() => submissions.refresh()}
            />

            <FormBuilderModal
                visible={builderVisible}
                template={editingTemplate}
                onClose={handleCloseBuilder}
                onSave={handleSaveBuilder}
                isSaving={crud.isSaving}
            />

            <CreateSessionModal
                visible={createSessionVisible}
                onClose={() => setCreateSessionVisible(false)}
                onCreated={(sessionId) => {
                    setCreateSessionVisible(false);
                    assessments.refresh();
                    router.push({ pathname: "/assessments/[sessionId]", params: { sessionId } });
                }}
            />
        </View>
    );
}


function AssessmentsList({
    drafts,
    sessions,
    isRefreshing,
    onRefresh,
    onPressSession,
    onCreateNew,
    paddingBottom,
}: {
    drafts: AssessmentDraft[];
    sessions: AssessmentSessionListItem[];
    isRefreshing: boolean;
    onRefresh: () => void;
    onPressSession: (id: string) => void;
    onCreateNew: () => void;
    paddingBottom: number;
}) {
    const dynColors = useV2Colors();
    // Memoize the sections payload — passing a fresh array literal as
    // SectionList's `sections` prop on every render forces SectionList's
    // internal state machine to re-derive, which cascades into a max-update
    // loop when the parent re-renders for any reason (e.g. a Zustand store
    // tick after finalize). The deps are the stable hook outputs.
    const sectionsArray = useMemo(() => {
        const out: Array<{ key: string; title: string; data: AssessmentSessionListItem[] }> = [];
        if (drafts.length > 0) {
            out.push({ key: "drafts", title: "Em andamento", data: drafts.map(draftToListItem) });
        }
        if (sessions.length > 0) {
            out.push({ key: "sessions", title: "Sessões", data: sessions });
        }
        return out;
    }, [drafts, sessions]);

    const tourSeen = useAssessmentOnboardingStore((s) => s.tourSeen);
    const markTourSeen = useAssessmentOnboardingStore((s) => s.markTourSeen);

    if (sectionsArray.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                {!tourSeen && (
                    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                        <AssessmentOnboardingCard
                            onDismiss={() => {
                                Haptics.selectionAsync();
                                markTourSeen();
                            }}
                        />
                    </View>
                )}
                <EmptyState
                    icon={<Activity size={40} color={colors.text.quaternary} />}
                    title="Nenhuma avaliação ainda"
                    description="Crie a primeira sessão pra capturar medições com o aluno presente."
                    actionLabel="+ Nova avaliação"
                    onAction={onCreateNew}
                />
            </View>
        );
    }

    return (
        <SectionList
            sections={sectionsArray}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom,
                gap: 8,
            }}
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={dynColors.brand.primary} />
            }
            renderSectionHeader={({ section }) => (
                <View style={{ marginTop: 12, marginBottom: 4 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: colors.text.tertiary,
                            textTransform: "uppercase",
                            letterSpacing: 1.4,
                        }}
                    >
                        {(section as { title: string }).title}
                    </Text>
                </View>
            )}
            renderItem={({ item, section }) => {
                const isDraftSection = (section as { key: string }).key === "drafts";
                const overdue = isOverdue(item);
                return (
                    <View style={{ marginBottom: 8 }}>
                        <SessionListItem
                            session={item}
                            isDraft={isDraftSection}
                            isOverdue={overdue}
                            onPress={onPressSession}
                        />
                    </View>
                );
            }}
            ListEmptyComponent={
                <EmptyState
                    icon={<Activity size={40} color={colors.text.quaternary} />}
                    title="Nenhuma avaliação"
                    description="Toque no + para iniciar uma nova"
                />
            }
        />
    );
}

function isOverdue(s: AssessmentSessionListItem): boolean {
    if (s.status === "completed" || s.status === "cancelled") return false;
    if (!s.scheduled_at) return false;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return Date.parse(s.scheduled_at) < cutoff;
}

function AssessmentOnboardingCard({ onDismiss }: { onDismiss: () => void }) {
    return (
        <View
            accessibilityRole="alert"
            accessibilityLabel="Dica de uso das avaliações presenciais"
            style={{
                borderRadius: 16,
                padding: 16,
                backgroundColor: colors.status.presencialBg,
                borderWidth: 1,
                borderColor: "rgba(139, 92, 246, 0.18)",
                gap: 10,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Activity size={16} color={colors.status.presencial} strokeWidth={2.4} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: colors.status.presencial,
                    }}
                >
                    Use templates do Kinevo
                </Text>
            </View>
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text.secondary }}>
                Já temos 5 templates prontos pra usar — Antropometria, Jackson & Pollock e
                Petroski. Toque no + pra agendar uma sessão. A captura das medições acontece
                com o aluno presente.
            </Text>
            <TouchableOpacity
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Entendi"
                style={{
                    alignSelf: "flex-start",
                    marginTop: 2,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.status.presencial,
                }}
            >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>
                    Entendi
                </Text>
            </TouchableOpacity>
        </View>
    );
}

function draftToListItem(d: AssessmentDraft): AssessmentSessionListItem {
    return {
        id: d.session_id,
        student_id: d.student_id,
        template_id: d.template_id,
        status: d.status,
        scheduled_at: null,
        started_at: d.last_touched_at,
        completed_at: null,
        computed_metrics: null,
        student_name: d.student_name,
        student_avatar: d.student_avatar,
        template_title: d.template_title,
    };
}
