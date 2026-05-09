import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
    View,
    Text,
    FlatList,
    SectionList,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from "react-native";
import { FormsSkeleton } from "../../components/shared/skeletons/FormsSkeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, ClipboardList, FileText, Plus } from "lucide-react-native";
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
import { SessionListItem } from "../../components/trainer/assessments/SessionListItem";
import { CreateSessionModal } from "../../components/trainer/assessments/CreateSessionModal";
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
        // isAssessmentTemplates → refresh delegado em B2 quando o hook chegar.
    }, [isResponses, isFormTemplates, isSessions, submissions, templates, assessments]);

    const isRefreshing =
        isResponses
            ? submissions.isRefreshing
            : isFormTemplates
                ? templates.isRefreshing
                : isSessions
                    ? assessments.isRefreshing
                    : false;
    const isLoading =
        isResponses
            ? submissions.isLoading
            : isFormTemplates
                ? templates.isLoading
                : isSessions
                    ? assessments.isLoading
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
        <View style={{ flex: 1, backgroundColor: colors.background.primary, paddingTop: insets.top }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text.primary }}>
                    Formulários
                </Text>
            </View>

            {/* M11 — Banner in-app de migração (1ª visita pós-deploy). */}
            <MigrationBannerMobile />

            {/* M11 — Segmented control (top-level). */}
            <View
                style={{
                    flexDirection: "row",
                    marginHorizontal: 20,
                    marginBottom: 10,
                    backgroundColor: "#e2e8f0",
                    borderRadius: 10,
                    padding: 3,
                }}
            >
                <TabButton
                    label="Formulários"
                    active={activeSegment === "formularios"}
                    onPress={() => {
                        Haptics.selectionAsync();
                        setActiveSegment("formularios");
                    }}
                />
                <TabButton
                    label="Avaliações"
                    badge={draftCount}
                    active={activeSegment === "avaliacoes"}
                    onPress={() => {
                        Haptics.selectionAsync();
                        setActiveSegment("avaliacoes");
                    }}
                />
            </View>

            {/* M11 — Sub-tabs por segmento. */}
            {activeSegment === "formularios" ? (
                <View
                    style={{
                        flexDirection: "row",
                        marginHorizontal: 20,
                        marginBottom: 12,
                        gap: 6,
                    }}
                >
                    <SubTabButton
                        label={`Respostas${submissions.counts.pending > 0 ? ` (${submissions.counts.pending})` : ""}`}
                        active={formsSubTab === "responses"}
                        onPress={() => setFormsSubTab("responses")}
                    />
                    <SubTabButton
                        label="Templates"
                        active={formsSubTab === "templates"}
                        onPress={() => setFormsSubTab("templates")}
                    />
                </View>
            ) : (
                <View
                    style={{
                        flexDirection: "row",
                        marginHorizontal: 20,
                        marginBottom: 12,
                        gap: 6,
                    }}
                >
                    <SubTabButton
                        label="Sessões"
                        badge={draftCount}
                        active={avaliacoesSubTab === "sessions"}
                        onPress={() => setAvaliacoesSubTab("sessions")}
                        accent="violet"
                    />
                    <SubTabButton
                        label="Templates"
                        active={avaliacoesSubTab === "a_templates"}
                        onPress={() => setAvaliacoesSubTab("a_templates")}
                        accent="violet"
                    />
                </View>
            )}

            {/* Filter chips */}
            {isResponses && (
                <View style={{ flexDirection: "row", paddingHorizontal: 20, marginBottom: 10, gap: 8 }}>
                    {FILTER_CHIPS.map((chip) => {
                        const isActive = submissions.filter === chip.key;
                        const count = submissions.counts[chip.key];
                        return (
                            <FilterChip
                                key={chip.key}
                                label={chip.label}
                                active={isActive}
                                count={count}
                                onPress={() => submissions.setFilter(chip.key)}
                            />
                        );
                    })}
                </View>
            )}
            {isSessions && (
                <View style={{ flexDirection: "row", paddingHorizontal: 20, marginBottom: 10, gap: 8 }}>
                    {ASSESSMENT_FILTER_CHIPS.map((chip) => {
                        const isActive = assessments.filter === chip.key;
                        const count = assessments.counts[chip.key];
                        return (
                            <FilterChip
                                key={chip.key}
                                label={chip.label}
                                active={isActive}
                                count={count}
                                onPress={() => assessments.setFilter(chip.key)}
                            />
                        );
                    })}
                </View>
            )}

            {/* Content */}
            {isLoading ? (
                <FormsSkeleton />
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
                            tintColor={colors.brand.primary}
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
                            tintColor={colors.brand.primary}
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
                   Listing real entrega em B2; aqui placeholder com CTA pra
                   criar novo template já funcional. */
                <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
                    <EmptyState
                        icon={<Activity size={40} color={colors.text.quaternary} />}
                        title="Templates de avaliação"
                        description="Listagem em desenvolvimento (B2). Use o botão + abaixo para criar."
                    />
                </View>
            )}

            {/* M11 — FAB matrix por (segment, subTab). Hidden em Respostas
                (não há ação default) e em Sessões quando lista vazia (o
                EmptyState exibe um CTA "+ Nova avaliação" próprio). */}
            {(() => {
                let fabConfig: { onPress: () => void; label: string; color: string } | null = null;
                if (isFormTemplates) {
                    fabConfig = {
                        onPress: handleCreateNew,
                        label: "Criar novo template de formulário",
                        color: "#7c3aed",
                    };
                } else if (isSessions && !isAssessmentsEmpty) {
                    fabConfig = {
                        onPress: handleCreateAssessmentSession,
                        label: "Nova avaliação",
                        color: colors.status.presencial,
                    };
                } else if (isAssessmentTemplates) {
                    fabConfig = {
                        onPress: () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            router.push("/assessments/templates/new");
                        },
                        label: "Novo template de avaliação",
                        color: "#7c3aed",
                    };
                }
                if (!fabConfig) return null;
                return (
                    <TouchableOpacity
                        onPress={fabConfig.onPress}
                        activeOpacity={0.8}
                        accessibilityLabel={fabConfig.label}
                        accessibilityRole="button"
                        style={{
                            position: "absolute",
                            right: 20,
                            bottom: insets.bottom + 66,
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: fabConfig.color,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: fabConfig.color,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.35,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        <Plus size={26} color="#ffffff" strokeWidth={2.5} />
                    </TouchableOpacity>
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

function TabButton({
    label,
    active,
    badge,
    onPress,
}: {
    label: string;
    active: boolean;
    badge?: number;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: active ? colors.background.card : "transparent",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
            }}
        >
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: active ? colors.text.primary : colors.text.secondary,
                }}
            >
                {label}
            </Text>
            {badge !== undefined && badge > 0 && (
                <View
                    style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: colors.status.presencial,
                        paddingHorizontal: 5,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ fontSize: 10, fontWeight: "800", color: colors.text.inverse }}>
                        {badge > 9 ? "9+" : badge}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

// M11 — sub-tab pill abaixo do segmented control. Visualmente mais leve que
// TabButton (sem fundo branco em estado ativo; sublinhado violet/cinza).
function SubTabButton({
    label,
    active,
    badge,
    onPress,
    accent = "default",
}: {
    label: string;
    active: boolean;
    badge?: number;
    onPress: () => void;
    accent?: "default" | "violet";
}) {
    const activeColor = accent === "violet" ? "#7c3aed" : colors.text.primary;
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? activeColor : "transparent",
                backgroundColor: active ? activeColor + "10" : "transparent",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
            }}
        >
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: active ? activeColor : colors.text.secondary,
                }}
            >
                {label}
            </Text>
            {badge !== undefined && badge > 0 && (
                <View
                    style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: colors.status.presencial,
                        paddingHorizontal: 5,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ fontSize: 10, fontWeight: "800", color: colors.text.inverse }}>
                        {badge > 9 ? "9+" : badge}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

function FilterChip({
    label,
    active,
    count,
    onPress,
}: {
    label: string;
    active: boolean;
    count: number;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filtro ${label}`}
            style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active ? colors.brand.primary : colors.background.card,
            }}
        >
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: active ? colors.text.inverse : colors.text.secondary,
                }}
            >
                {label} {count > 0 ? `(${count})` : ""}
            </Text>
        </TouchableOpacity>
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
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />
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
