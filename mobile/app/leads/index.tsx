import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Linking,
    RefreshControl,
    ActivityIndicator,
    Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    ChevronLeft,
    Inbox,
    MessageCircle,
    Archive,
    UserPlus,
    UserCheck,
    Clock,
    Mail,
    Phone,
    X,
    AlertCircle,
    Sparkles,
    Copy,
    Check,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import { v2 } from "@kinevo/shared/tokens";
import { useV2Colors } from "../../hooks/useV2Colors";
import * as Haptics from "expo-haptics";
import { useTrainerLeads, type TrainerLead, type LeadStatus, type ConvertLeadResult } from "../../hooks/useTrainerLeads";
import { KCard, KSegmented, KButton } from "../../components/v2";
import { PressableScale } from "../../components/shared/PressableScale";
import { AdaptiveModal } from "../../components/shared/AdaptiveModal";
import { toRgba } from "../../lib/brandColor";

const { typography, spacing, radius } = v2;

type FilterKey = "all" | "new" | "contacted" | "converted" | "archived";

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "new", label: "Novos" },
    { key: "contacted", label: "Contatados" },
    { key: "converted", label: "Convertidos" },
];

function relativeTime(iso: string) {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "agora";
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `há ${d}d`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function whatsappLink(whatsapp: string, firstName: string) {
    const digits = whatsapp.replace(/\D/g, "");
    const number = digits.length === 11 || digits.length === 10 ? `55${digits}` : digits;
    const greeting =
        `Oi ${firstName}, tudo bem? 👋 Vi que você se interessou em treinar comigo. ` +
        `Me conta um pouco do seu objetivo que eu te explico como funciona o acompanhamento. 💪`;
    return `https://wa.me/${number}?text=${encodeURIComponent(greeting)}`;
}

export default function LeadsScreen() {
    const router = useRouter();
    const colors = useV2Colors();
    const { leads, loading, refetch, updateStatus, convertLead } = useTrainerLeads();
    const [filter, setFilter] = useState<FilterKey>("all");
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<{
        name: string; email: string; password: string; whatsapp: string | null;
    } | null>(null);

    // Deriva o lead selecionado da lista pra refletir updates (status/conversão)
    // sem manter uma cópia desatualizada.
    const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null;

    const counts = useMemo(() => {
        const c = { all: 0, new: 0, contacted: 0, converted: 0 };
        for (const l of leads) {
            if (l.status === "archived") continue;
            c.all++;
            if (l.status === "new") c.new++;
            else if (l.status === "contacted" || l.status === "read") c.contacted++;
            else if (l.status === "converted") c.converted++;
        }
        return c;
    }, [leads]);

    const filtered = useMemo(() => {
        return leads.filter((l) => {
            if (filter === "all") return l.status !== "archived";
            if (filter === "new") return l.status === "new";
            if (filter === "contacted") return l.status === "contacted" || l.status === "read";
            if (filter === "converted") return l.status === "converted";
            if (filter === "archived") return l.status === "archived";
            return true;
        });
    }, [leads, filter]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const onSelect = (lead: TrainerLead) => {
        setSelectedId(lead.id);
        if (lead.status === "new") void updateStatus(lead.id, "read");
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.subtle,
                }}
            >
                <PressableScale
                    onPress={() => router.back()}
                    pressScale={0.92}
                    style={{ padding: spacing[1] }}
                    accessibilityLabel="Voltar"
                >
                    <ChevronLeft size={24} color={colors.text.primary} strokeWidth={2} />
                </PressableScale>
                <View style={{ flex: 1, marginLeft: spacing[2] }}>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_700Bold",
                            fontSize: 18,
                            color: colors.text.primary,
                        }}
                    >
                        Leads
                    </Text>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: 12,
                            color: colors.text.tertiary,
                            marginTop: 1,
                        }}
                    >
                        {counts.all} ativos · vindos da landing
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: spacing[10] }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Filtros */}
                {leads.length > 0 && (
                    <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2] }}>
                        <KSegmented<FilterKey>
                            items={FILTERS.map((f) => ({
                                value: f.key,
                                label: f.label,
                                count: f.key === "all"
                                    ? counts.all
                                    : f.key === "new"
                                        ? counts.new
                                        : f.key === "contacted"
                                            ? counts.contacted
                                            : counts.converted,
                            }))}
                            value={filter}
                            onChange={(k) => setFilter(k)}
                        />
                    </View>
                )}

                {/* Loading */}
                {loading && leads.length === 0 ? (
                    <View style={{ paddingTop: spacing[10], alignItems: "center" }}>
                        <ActivityIndicator color={colors.brand.primary} />
                    </View>
                ) : leads.length === 0 ? (
                    /* Empty global */
                    <EmptyState colors={colors} />
                ) : filtered.length === 0 ? (
                    <View
                        style={{
                            paddingHorizontal: spacing[4],
                            paddingVertical: spacing[8],
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_500Medium",
                                fontSize: 13,
                                color: colors.text.tertiary,
                            }}
                        >
                            Nenhum lead nessa categoria.
                        </Text>
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
                        {filtered.map((lead, idx) => (
                            <Animated.View
                                key={lead.id}
                                entering={FadeInUp.delay(Math.min(idx * 30, 200))
                                    .duration(280)
                                    .easing(Easing.out(Easing.cubic))}
                            >
                                <LeadRow lead={lead} colors={colors} onPress={() => onSelect(lead)} />
                            </Animated.View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Drawer / Modal de detalhe */}
            <AdaptiveModal
                visible={!!selected && !credentials}
                onClose={() => setSelectedId(null)}
                title={selected?.name ?? ""}
            >
                {selected && (
                    <LeadDetail
                        lead={selected}
                        colors={colors}
                        onUpdateStatus={(s) => updateStatus(selected.id, s)}
                        onConvert={(modality) => convertLead(selected, modality)}
                        onConverted={(studentId, creds) => {
                            if (creds && creds.password) {
                                setCredentials(creds);
                            } else {
                                setSelectedId(null);
                                router.push(`/student/${studentId}` as never);
                            }
                        }}
                        onViewStudent={(studentId) => {
                            setSelectedId(null);
                            router.push(`/student/${studentId}` as never);
                        }}
                        onClose={() => setSelectedId(null)}
                    />
                )}
            </AdaptiveModal>

            {/* Credenciais do aluno recém-criado */}
            <AdaptiveModal
                visible={!!credentials}
                onClose={() => {
                    const studentId = selected?.converted_to_student_id;
                    setCredentials(null);
                    setSelectedId(null);
                    if (studentId) router.push(`/student/${studentId}` as never);
                }}
                title="Aluno criado"
            >
                {credentials && <CredentialsView credentials={credentials} colors={colors} />}
            </AdaptiveModal>
        </SafeAreaView>
    );
}

/* ───────── Lead row ───────── */
function LeadRow({
    lead,
    colors,
    onPress,
}: {
    lead: TrainerLead;
    colors: ReturnType<typeof useV2Colors>;
    onPress: () => void;
}) {
    const isNew = lead.status === "new";
    const statusMeta = STATUS_META(colors)[lead.status];

    return (
        <PressableScale onPress={onPress} pressScale={0.985} style={{ marginBottom: spacing[2] }}>
            <KCard style={{ padding: spacing[3] + 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: toRgba(colors.brand.primary, 0.12),
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: spacing[3],
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_700Bold",
                                fontSize: 16,
                                color: colors.brand.primary,
                            }}
                        >
                            {lead.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text
                                style={{
                                    fontFamily: isNew ? "PlusJakartaSans_700Bold" : "PlusJakartaSans_600SemiBold",
                                    fontSize: 14,
                                    color: colors.text.primary,
                                    flexShrink: 1,
                                }}
                                numberOfLines={1}
                            >
                                {lead.name}
                            </Text>
                            <StatusPill meta={statusMeta} />
                        </View>
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_500Medium",
                                fontSize: 12,
                                color: colors.text.tertiary,
                                marginTop: 2,
                            }}
                            numberOfLines={1}
                        >
                            {lead.goal ? `${lead.goal} · ` : ""}
                            {lead.message?.slice(0, 60) || lead.email}
                        </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", marginLeft: spacing[2] }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Clock size={10} color={colors.text.quaternary} strokeWidth={2} />
                            <Text
                                style={{
                                    fontFamily: "PlusJakartaSans_500Medium",
                                    fontSize: 11,
                                    color: colors.text.quaternary,
                                }}
                            >
                                {relativeTime(lead.created_at)}
                            </Text>
                        </View>
                    </View>
                </View>
            </KCard>
        </PressableScale>
    );
}

/* ───────── Lead detail (modal body) ───────── */
function LeadDetail({
    lead,
    colors,
    onUpdateStatus,
    onConvert,
    onConverted,
    onViewStudent,
    onClose,
}: {
    lead: TrainerLead;
    colors: ReturnType<typeof useV2Colors>;
    onUpdateStatus: (s: LeadStatus) => void;
    onConvert: (modality: "online" | "presential") => Promise<ConvertLeadResult>;
    onConverted: (studentId: string, credentials: ConvertLeadResult["credentials"]) => void;
    onViewStudent: (studentId: string) => void;
    onClose: () => void;
}) {
    const firstName = lead.name.split(" ")[0] ?? lead.name;
    const meta = STATUS_META(colors)[lead.status];

    const [showConvert, setShowConvert] = useState(false);
    const [modality, setModality] = useState<"online" | "presential">("online");
    const [converting, setConverting] = useState(false);
    const [convertError, setConvertError] = useState<string | null>(null);

    const isConverted = lead.status === "converted" && !!lead.converted_to_student_id;

    const handleConvert = async () => {
        setConvertError(null);
        setConverting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await onConvert(modality);
        setConverting(false);
        if (!result.success || !result.studentId) {
            setConvertError(result.error ?? "Não foi possível converter.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowConvert(false);
        onConverted(result.studentId, result.credentials);
    };

    const openWhatsApp = () => {
        void Linking.openURL(whatsappLink(lead.whatsapp, firstName));
        if (lead.status === "new" || lead.status === "read") {
            onUpdateStatus("contacted");
        }
    };

    return (
        <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}>
            {/* Status + fonte */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: spacing[4],
                }}
            >
                <StatusPill meta={meta} />
                {lead.source_slug && (
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_700Bold",
                            fontSize: 10,
                            color: colors.text.quaternary,
                            textTransform: "uppercase",
                            letterSpacing: 1.2,
                        }}
                    >
                        Via /com/{lead.source_slug}
                    </Text>
                )}
            </View>

            {/* WhatsApp CTA */}
            <KButton
                label="Abrir WhatsApp"
                onPress={openWhatsApp}
                variant="primary"
                size="lg"
                leadingIcon={<MessageCircle size={16} color="#fff" strokeWidth={2.4} />}
                style={{ marginBottom: spacing[5] }}
            />

            {/* Contato */}
            <SectionHeader colors={colors} title="Contato" />
            <KCard style={{ padding: 0 }}>
                <DetailRow
                    colors={colors}
                    icon={<Mail size={14} color={colors.text.tertiary} strokeWidth={2} />}
                    value={lead.email}
                />
                <Divider colors={colors} />
                <DetailRow
                    colors={colors}
                    icon={<Phone size={14} color={colors.text.tertiary} strokeWidth={2} />}
                    value={lead.whatsapp}
                />
            </KCard>

            {/* Sobre o lead */}
            {(lead.goal || lead.level) && (
                <>
                    <SectionHeader colors={colors} title="Sobre" />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {lead.goal && (
                            <View
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: radius.sm,
                                    backgroundColor: toRgba(colors.brand.primary, 0.12),
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: "PlusJakartaSans_700Bold",
                                        fontSize: 12,
                                        color: colors.brand.primary,
                                    }}
                                >
                                    {lead.goal}
                                </Text>
                            </View>
                        )}
                        {lead.level && (
                            <View
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: radius.sm,
                                    backgroundColor: colors.border.subtle,
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: "PlusJakartaSans_700Bold",
                                        fontSize: 12,
                                        color: colors.text.secondary,
                                    }}
                                >
                                    {lead.level}
                                </Text>
                            </View>
                        )}
                    </View>
                </>
            )}

            {/* Mensagem */}
            {lead.message && (
                <>
                    <SectionHeader colors={colors} title="Mensagem" />
                    <KCard>
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_500Medium",
                                fontSize: 13.5,
                                color: colors.text.secondary,
                                lineHeight: 20,
                            }}
                        >
                            {lead.message}
                        </Text>
                    </KCard>
                </>
            )}

            {/* Conversão */}
            <SectionHeader colors={colors} title="Conversão" />
            {isConverted ? (
                <KButton
                    label="Ver aluno"
                    variant="primary"
                    size="lg"
                    onPress={() => lead.converted_to_student_id && onViewStudent(lead.converted_to_student_id)}
                    leadingIcon={<UserCheck size={15} color="#fff" strokeWidth={2.4} />}
                />
            ) : showConvert ? (
                <View style={{ gap: spacing[2] }}>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: 12.5,
                            color: colors.text.tertiary,
                            lineHeight: 18,
                        }}
                    >
                        Cria {firstName} como aluno cortesia (sem contrato). Escolha a modalidade:
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {(["online", "presential"] as const).map((m) => (
                            <View key={m} style={{ flex: 1 }}>
                                <KButton
                                    label={m === "online" ? "Online" : "Presencial"}
                                    variant={modality === m ? "primary" : "outline"}
                                    size="md"
                                    onPress={() => setModality(m)}
                                />
                            </View>
                        ))}
                    </View>
                    {convertError && (
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_500Medium",
                                fontSize: 12.5,
                                color: colors.semantic.danger.default,
                            }}
                        >
                            {convertError}
                        </Text>
                    )}
                    <KButton
                        label={converting ? "Criando…" : "Criar aluno"}
                        variant="primary"
                        size="lg"
                        disabled={converting}
                        onPress={handleConvert}
                        leadingIcon={<UserPlus size={15} color="#fff" strokeWidth={2.4} />}
                    />
                    <KButton
                        label="Cancelar"
                        variant="ghost"
                        size="md"
                        disabled={converting}
                        onPress={() => { setShowConvert(false); setConvertError(null); }}
                    />
                </View>
            ) : (
                <KButton
                    label="Converter em aluno"
                    variant="primary"
                    size="lg"
                    onPress={() => { setShowConvert(true); setConvertError(null); }}
                    leadingIcon={<UserPlus size={15} color="#fff" strokeWidth={2.4} />}
                />
            )}

            {/* Status actions */}
            <SectionHeader colors={colors} title="Status" />
            <KButton
                label={lead.status === "contacted" ? "Contatado" : "Marcar como contatado"}
                variant={lead.status === "contacted" ? "primary" : "outline"}
                size="md"
                disabled={isConverted}
                onPress={() => onUpdateStatus("contacted")}
                leadingIcon={
                    <MessageCircle
                        size={13}
                        color={lead.status === "contacted" ? "#fff" : colors.text.secondary}
                        strokeWidth={2.4}
                    />
                }
            />
            <View style={{ height: spacing[2] }} />
            <KButton
                label={lead.status === "archived" ? "Arquivado" : "Arquivar"}
                variant="ghost"
                size="md"
                onPress={() => {
                    onUpdateStatus("archived");
                    onClose();
                }}
                disabled={lead.status === "archived"}
                leadingIcon={<Archive size={13} color={colors.text.tertiary} strokeWidth={2.2} />}
            />
        </View>
    );
}

/* ───────── Credenciais do aluno criado ───────── */
function CredentialsView({
    credentials,
    colors,
}: {
    credentials: { name: string; email: string; password: string; whatsapp: string | null };
    colors: ReturnType<typeof useV2Colors>;
}) {
    const [copied, setCopied] = useState(false);

    const message =
        `Olá ${credentials.name}! 👋\n\nSuas credenciais de acesso ao Kinevo:\n\n` +
        `📧 Email: ${credentials.email}\n🔑 Senha: ${credentials.password}\n\n` +
        `Baixe o app e faça login para começar! 💪`;

    const handleCopy = async () => {
        try {
            const Clipboard = require("expo-clipboard");
            if (Clipboard?.setStringAsync) {
                await Clipboard.setStringAsync(message);
                setCopied(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => setCopied(false), 1800);
            }
        } catch { /* ignore */ }
    };

    const handleShare = () => {
        Share.share({ message }).catch(() => {});
    };

    return (
        <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}>
            <View
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: toRgba(colors.semantic.success.default, 0.14),
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: spacing[3],
                }}
            >
                <UserCheck size={24} color={colors.semantic.success.default} strokeWidth={2} />
            </View>
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 18,
                    color: colors.text.primary,
                    marginBottom: spacing[1],
                }}
            >
                {credentials.name} agora é seu aluno
            </Text>
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_500Medium",
                    fontSize: 13.5,
                    color: colors.text.tertiary,
                    lineHeight: 20,
                    marginBottom: spacing[4],
                }}
            >
                Compartilhe as credenciais pra ele entrar no app. A senha só aparece agora.
            </Text>

            <KCard style={{ padding: 0, marginBottom: spacing[4] }}>
                <DetailRow
                    colors={colors}
                    icon={<Mail size={14} color={colors.text.tertiary} strokeWidth={2} />}
                    value={credentials.email}
                />
                <Divider colors={colors} />
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[3],
                        gap: spacing[3],
                    }}
                >
                    <Text style={{ fontSize: 14 }}>🔑</Text>
                    <Text
                        style={{
                            flex: 1,
                            fontFamily: "PlusJakartaSans_700Bold",
                            fontSize: 15,
                            color: colors.text.primary,
                            letterSpacing: 0.5,
                        }}
                    >
                        {credentials.password}
                    </Text>
                </View>
            </KCard>

            <KButton
                label={copied ? "Copiado!" : "Copiar credenciais"}
                variant="primary"
                size="lg"
                onPress={handleCopy}
                leadingIcon={
                    copied
                        ? <Check size={15} color="#fff" strokeWidth={2.6} />
                        : <Copy size={15} color="#fff" strokeWidth={2.4} />
                }
            />
            <View style={{ height: spacing[2] }} />
            <KButton
                label="Enviar pelo WhatsApp"
                variant="outline"
                size="md"
                onPress={handleShare}
                leadingIcon={<MessageCircle size={14} color={colors.text.secondary} strokeWidth={2.4} />}
            />
        </View>
    );
}

/* ───────── Empty state ───────── */
function EmptyState({ colors }: { colors: ReturnType<typeof useV2Colors> }) {
    const router = useRouter();
    return (
        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[10], alignItems: "center" }}>
            <View
                style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: toRgba(colors.brand.primary, 0.12),
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: spacing[4],
                }}
            >
                <Inbox size={28} color={colors.brand.primary} strokeWidth={1.8} />
            </View>
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 18,
                    color: colors.text.primary,
                    marginBottom: spacing[2],
                    textAlign: "center",
                }}
            >
                Nenhum lead ainda
            </Text>
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_500Medium",
                    fontSize: 13.5,
                    color: colors.text.tertiary,
                    textAlign: "center",
                    lineHeight: 20,
                    marginBottom: spacing[5],
                    maxWidth: 280,
                }}
            >
                Compartilhe sua URL pública na bio do Instagram. O primeiro lead chega logo.
            </Text>
            <KButton
                label="Configurar landing"
                variant="primary"
                size="md"
                onPress={() => router.push("/trainer-profile" as never)}
                leadingIcon={<Sparkles size={13} color="#fff" strokeWidth={2.4} />}
            />
        </View>
    );
}

/* ───────── Helpers ───────── */
function SectionHeader({
    colors,
    title,
}: {
    colors: ReturnType<typeof useV2Colors>;
    title: string;
}) {
    return (
        <Text
            style={{
                fontFamily: "PlusJakartaSans_700Bold",
                fontSize: 11,
                color: colors.text.tertiary,
                textTransform: "uppercase",
                letterSpacing: 1.4,
                marginTop: spacing[5],
                marginBottom: spacing[2],
            }}
        >
            {title}
        </Text>
    );
}

function DetailRow({
    colors,
    icon,
    value,
}: {
    colors: ReturnType<typeof useV2Colors>;
    icon: React.ReactNode;
    value: string;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                gap: spacing[3],
            }}
        >
            {icon}
            <Text
                style={{
                    flex: 1,
                    fontFamily: "PlusJakartaSans_500Medium",
                    fontSize: 13,
                    color: colors.text.primary,
                }}
                numberOfLines={1}
            >
                {value}
            </Text>
        </View>
    );
}

function Divider({ colors }: { colors: ReturnType<typeof useV2Colors> }) {
    return <View style={{ height: 1, backgroundColor: colors.border.subtle }} />;
}

function StatusPill({ meta }: { meta: { label: string; bg: string; fg: string; dot: string } }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: meta.bg,
            }}
        >
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: meta.dot }} />
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 9.5,
                    color: meta.fg,
                    textTransform: "uppercase",
                    letterSpacing: 1.1,
                }}
            >
                {meta.label}
            </Text>
        </View>
    );
}

function STATUS_META(colors: ReturnType<typeof useV2Colors>): Record<
    LeadStatus,
    { label: string; bg: string; fg: string; dot: string }
> {
    return {
        new: {
            label: "Novo",
            bg: toRgba(colors.brand.primary, 0.14),
            fg: colors.brand.primary,
            dot: colors.brand.primary,
        },
        read: {
            label: "Lido",
            bg: colors.border.subtle,
            fg: colors.text.tertiary,
            dot: colors.text.quaternary,
        },
        contacted: {
            label: "Contatado",
            bg: toRgba(colors.semantic.warning.default, 0.14),
            fg: colors.semantic.warning.default,
            dot: colors.semantic.warning.default,
        },
        converted: {
            label: "Convertido",
            bg: toRgba(colors.semantic.success.default, 0.14),
            fg: colors.semantic.success.default,
            dot: colors.semantic.success.default,
        },
        archived: {
            label: "Arquivado",
            bg: colors.border.subtle,
            fg: colors.text.quaternary,
            dot: colors.text.quaternary,
        },
    };
}
