import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FileText, MessageSquare, Bell, ChevronRight } from "lucide-react-native";
import { useInbox, type InboxItem } from "../../hooks/useInbox";

function TypeIcon({ type }: { type: InboxItem["type"] }) {
    if (type === "form_request") return <FileText size={18} color="#8b5cf6" />;
    if (type === "feedback") return <MessageSquare size={18} color="#22c55e" />;
    return <Bell size={18} color="#38bdf8" />;
}

function typeLabel(type: InboxItem["type"]) {
    if (type === "form_request") return "Formulário";
    if (type === "feedback") return "Feedback";
    if (type === "system_alert") return "Alerta";
    return "Mensagem";
}

function statusLabel(status: InboxItem["status"]) {
    if (status === "unread") return "Não lido";
    if (status === "pending_action") return "Pendente";
    if (status === "completed") return "Concluído";
    return "Arquivado";
}

function InboxCard({
    item,
    onPress,
}: {
    item: InboxItem;
    onPress: (item: InboxItem) => void;
}) {
    return (
        <Pressable
            onPress={() => onPress(item)}
            style={{
                backgroundColor: "#1A1A2E",
                borderWidth: 1,
                borderColor: "rgba(148,163,184,0.15)",
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: "rgba(148,163,184,0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                    }}
                >
                    <TypeIcon type={item.type} />
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 14 }}>{item.title}</Text>
                    {!!item.subtitle && (
                        <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                            {item.subtitle}
                        </Text>
                    )}
                    <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                        <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
                            {typeLabel(item.type).toUpperCase()}
                        </Text>
                        <Text style={{ color: "#64748b", fontSize: 10 }}>•</Text>
                        <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
                            {statusLabel(item.status).toUpperCase()}
                        </Text>
                    </View>
                </View>

                <ChevronRight size={18} color="#64748b" />
            </View>
        </Pressable>
    );
}

export default function InboxScreen() {
    const router = useRouter();
    const { pendingItems, completedItems, unreadCount, isLoading, isRefreshing, refresh, markItemOpened } = useInbox();

    const handleOpenItem = async (item: InboxItem) => {
        await markItemOpened(item);
        router.push(`/inbox/${item.id}`);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D17" }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#8b5cf6" />
                }
            >
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#f1f5f9" }}>Inbox</Text>
                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    Solicitações, feedbacks e mensagens do seu treinador.
                </Text>

                <View
                    style={{
                        marginTop: 14,
                        marginBottom: 14,
                        backgroundColor: "#1A1A2E",
                        borderWidth: 1,
                        borderColor: "rgba(148,163,184,0.15)",
                        borderRadius: 12,
                        padding: 12,
                    }}
                >
                    <Text style={{ color: "#94a3b8", fontSize: 12 }}>Não lidos</Text>
                    <Text style={{ color: "#f1f5f9", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
                        {unreadCount}
                    </Text>
                </View>

                <Text
                    style={{
                        marginBottom: 10,
                        color: "rgba(255,255,255,0.45)",
                        fontSize: 11,
                        letterSpacing: 2,
                        fontWeight: "700",
                        textTransform: "uppercase",
                    }}
                >
                    Pendentes
                </Text>

                {isLoading ? (
                    <Text style={{ color: "#64748b", marginBottom: 18 }}>Carregando inbox...</Text>
                ) : pendingItems.length === 0 ? (
                    <Text style={{ color: "#64748b", marginBottom: 18 }}>Nenhum item pendente.</Text>
                ) : (
                    pendingItems.map((item) => (
                        <InboxCard key={item.id} item={item} onPress={handleOpenItem} />
                    ))
                )}

                <Text
                    style={{
                        marginTop: 10,
                        marginBottom: 10,
                        color: "rgba(255,255,255,0.45)",
                        fontSize: 11,
                        letterSpacing: 2,
                        fontWeight: "700",
                        textTransform: "uppercase",
                    }}
                >
                    Concluídos
                </Text>

                {completedItems.length === 0 ? (
                    <Text style={{ color: "#64748b" }}>Nenhum item concluído.</Text>
                ) : (
                    completedItems.map((item) => (
                        <InboxCard key={item.id} item={item} onPress={handleOpenItem} />
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
