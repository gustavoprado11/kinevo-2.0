import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import {
    UserPlus,
    FileText,
    DollarSign,
    CheckCircle,
    XCircle,
    Ban,
    AlertTriangle,
    Lock,
    Unlock,
    ArrowRightLeft,
} from "lucide-react-native";
import type { ContractEvent, ContractEventType } from "../../types/financial";
import type { LucideIcon } from "lucide-react-native";

const EVENT_CONFIG: Record<ContractEventType, { icon: LucideIcon; color: string; label: string }> = {
    student_registered: { icon: UserPlus, color: "#3b82f6", label: "Aluno registrado" },
    contract_created: { icon: FileText, color: "#7c3aed", label: "Contrato criado" },
    contract_migrated: { icon: ArrowRightLeft, color: "#0ea5e9", label: "Contrato migrado" },
    payment_received: { icon: DollarSign, color: "#16a34a", label: "Pagamento recebido" },
    payment_failed: { icon: XCircle, color: "#ef4444", label: "Pagamento falhou" },
    contract_canceled: { icon: Ban, color: "#ef4444", label: "Contrato cancelado" },
    contract_overdue: { icon: AlertTriangle, color: "#f59e0b", label: "Contrato inadimplente" },
    plan_changed: { icon: ArrowRightLeft, color: "#7c3aed", label: "Plano alterado" },
    access_blocked: { icon: Lock, color: "#ef4444", label: "Acesso bloqueado" },
    access_unblocked: { icon: Unlock, color: "#16a34a", label: "Acesso liberado" },
};

function formatEventDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getEventDetail(event: ContractEvent): string | null {
    const meta = event.metadata || {};
    if (event.event_type === "payment_received" && meta.amount) {
        return `R$ ${Number(meta.amount).toFixed(2).replace(".", ",")} — ${meta.method || ""}`;
    }
    if (event.event_type === "contract_canceled" && meta.canceled_by) {
        const scheduled = meta.scheduled ? " (agendado)" : "";
        return `Por ${meta.canceled_by === "trainer" ? "treinador" : "aluno"}${scheduled}`;
    }
    if (event.event_type === "plan_changed" && meta.plan_title) {
        return String(meta.plan_title);
    }
    return null;
}

interface Props {
    events: ContractEvent[];
    isLoading: boolean;
}

export function ContractTimeline({ events, isLoading }: Props) {
    if (isLoading) {
        return (
            <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color="#7c3aed" size="small" />
            </View>
        );
    }

    if (events.length === 0) {
        return (
            <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: "#94a3b8" }}>
                    Nenhum evento registrado
                </Text>
            </View>
        );
    }

    return (
        <View>
            {events.map((event, idx) => {
                const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.contract_created;
                const Icon = config.icon;
                const detail = getEventDetail(event);
                const isLast = idx === events.length - 1;

                return (
                    <View key={event.id} style={{ flexDirection: "row" }}>
                        {/* Timeline line + dot */}
                        <View style={{ width: 40, alignItems: "center" }}>
                            <View
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: `${config.color}15`,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Icon size={14} color={config.color} />
                            </View>
                            {!isLast && (
                                <View
                                    style={{
                                        width: 2,
                                        flex: 1,
                                        backgroundColor: "#e2e8f0",
                                        marginVertical: 4,
                                    }}
                                />
                            )}
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingLeft: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a" }}>
                                {config.label}
                            </Text>
                            {detail && (
                                <Text style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                                    {detail}
                                </Text>
                            )}
                            <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                {formatEventDate(event.created_at)}
                            </Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}
