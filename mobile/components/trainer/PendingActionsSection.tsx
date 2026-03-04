import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { CreditCard, FileText, UserX, CalendarClock } from "lucide-react-native";
import type {
    PendingFinancialItem,
    PendingFormItem,
    InactiveStudentItem,
    ExpiringProgramItem,
} from "../../hooks/useTrainerDashboard";

// ── Generic Action Card ──

function ActionCard({
    icon: Icon,
    iconColor,
    iconBg,
    title,
    subtitle,
    badge,
    badgeColor,
}: {
    icon: typeof CreditCard;
    iconColor: string;
    iconBg: string;
    title: string;
    subtitle: string;
    badge?: string;
    badgeColor?: string;
}) {
    return (
        <View
            style={{
                width: 200,
                backgroundColor: "#ffffff",
                borderRadius: 16,
                padding: 14,
                marginRight: 10,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: iconBg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                    }}
                >
                    <Icon size={16} color={iconColor} />
                </View>
                {!!badge && (
                    <View
                        style={{
                            backgroundColor: badgeColor || "#fef2f2",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 100,
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: iconColor }}>
                            {badge}
                        </Text>
                    </View>
                )}
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0f172a" }} numberOfLines={1}>
                {title}
            </Text>
            <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }} numberOfLines={2}>
                {subtitle}
            </Text>
        </View>
    );
}

// ── Main Component ──

interface PendingActionsSectionProps {
    pendingFinancial: PendingFinancialItem[];
    pendingForms: PendingFormItem[];
    inactiveStudents: InactiveStudentItem[];
    expiringPrograms: ExpiringProgramItem[];
}

export function PendingActionsSection({
    pendingFinancial,
    pendingForms,
    inactiveStudents,
    expiringPrograms,
}: PendingActionsSectionProps) {
    const totalActions = pendingFinancial.length + pendingForms.length + inactiveStudents.length + expiringPrograms.length;

    if (totalActions === 0) return null;

    return (
        <View style={{ marginBottom: 20 }}>
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#94a3b8",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 10,
                    paddingLeft: 1,
                }}
            >
                Ações pendentes
            </Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20 }}
            >
                {pendingFinancial.map((item) => (
                    <ActionCard
                        key={`fin-${item.id}`}
                        icon={CreditCard}
                        iconColor="#ef4444"
                        iconBg="#fef2f2"
                        title={item.student_name}
                        subtitle={`R$ ${item.amount?.toFixed(2)} — ${item.status === "past_due" ? "Vencido" : "Pendente"}`}
                        badge={item.billing_type === "manual_recurring" ? "Manual" : "Stripe"}
                        badgeColor="#fef2f2"
                    />
                ))}
                {pendingForms.map((item) => (
                    <ActionCard
                        key={`form-${item.id}`}
                        icon={FileText}
                        iconColor="#7c3aed"
                        iconBg="#f5f3ff"
                        title={item.student_name}
                        subtitle={item.template_title}
                        badge="Formulário"
                        badgeColor="#f5f3ff"
                    />
                ))}
                {inactiveStudents.map((item) => (
                    <ActionCard
                        key={`inactive-${item.id}`}
                        icon={UserX}
                        iconColor="#f59e0b"
                        iconBg="#fffbeb"
                        title={item.name}
                        subtitle={`${item.days_since_last_session >= 999 ? "Nunca treinou" : `${item.days_since_last_session} dias sem treinar`} — ${item.program_name}`}
                        badge="Inativo"
                        badgeColor="#fffbeb"
                    />
                ))}
                {expiringPrograms.map((item, i) => (
                    <ActionCard
                        key={`exp-${i}`}
                        icon={CalendarClock}
                        iconColor="#0ea5e9"
                        iconBg="#f0f9ff"
                        title={item.student_name}
                        subtitle={`${item.program_name} — ${item.ends_in_days <= 0 ? "Expirado" : `${item.ends_in_days}d restantes`}`}
                        badge="Expirando"
                        badgeColor="#f0f9ff"
                    />
                ))}
            </ScrollView>
        </View>
    );
}
