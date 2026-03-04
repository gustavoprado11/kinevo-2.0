import React from "react";
import { View, Text } from "react-native";
import type { FinancialTransaction } from "../../types/financial";

function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

const STATUS_COLORS: Record<string, string> = {
    succeeded: "#16a34a",
    pending: "#f59e0b",
    failed: "#ef4444",
};

interface Props {
    transaction: FinancialTransaction;
}

export function TransactionRow({ transaction }: Props) {
    const dotColor = STATUS_COLORS[transaction.status] || "#94a3b8";

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                gap: 12,
            }}
        >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a" }} numberOfLines={1}>
                    {transaction.student_name || transaction.description || "Transação"}
                </Text>
                <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {transaction.description ? transaction.description : transaction.type} · {timeAgo(transaction.created_at)}
                </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a" }}>
                {formatCurrency(transaction.amount_gross)}
            </Text>
        </View>
    );
}
