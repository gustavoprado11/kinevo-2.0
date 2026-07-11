import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type {
    FinancialStudent,
    FinancialDashboardData,
    FinancialTransaction,
} from "../types/financial";

export interface PendingCharge {
    contractId: string;
    studentName: string | null;
    amount: number;
    billingType: string | null;
    createdAt: string;
}

export interface AwaitingPayout {
    id: string;
    amount: number;
    requestedAt: string | null;
    pixKeyType: string | null;
}

export function useFinancialDashboard() {
    const { trainerId } = useRoleMode();
    const [data, setData] = useState<FinancialDashboardData | null>(null);
    const [attentionStudents, setAttentionStudents] = useState<FinancialStudent[]>([]);
    const [pendingCharges, setPendingCharges] = useState<PendingCharge[]>([]);
    const [awaitingPayouts, setAwaitingPayouts] = useState<AwaitingPayout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (refreshing = false) => {
        if (!trainerId) return;

        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const [studentsRes, dashboardRes, pendingRes, payoutsRes] = await Promise.all([
                (supabase as any).rpc("get_financial_students", { p_trainer_id: trainerId }),
                (supabase as any).rpc("get_financial_dashboard"),
                (supabase as any)
                    .from("student_contracts")
                    .select("id, amount, billing_type, student_id, created_at")
                    .eq("trainer_id", trainerId)
                    .eq("status", "pending_payment")
                    .not("asaas_payment_link_id", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(20),
                (supabase as any)
                    .from("payouts")
                    .select("id, amount_cents, requested_at, pix_key_type_snapshot")
                    .eq("trainer_id", trainerId)
                    .eq("status", "awaiting_authorization")
                    .order("requested_at", { ascending: false })
                    .limit(5),
            ]);

            // supabase-js NÃO rejeita em falha de rede/RPC — resolve com
            // { data: null, error }. Sem esta checagem o catch do P16 nunca
            // dispara e a tela renderiza R$ 0,00 como dado real.
            const failed =
                studentsRes?.error ?? dashboardRes?.error ?? pendingRes?.error ?? payoutsRes?.error;
            if (failed) throw new Error(failed.message ?? "RPC error");

            const students: FinancialStudent[] = (studentsRes.data as any) || [];
            const dashboard = (dashboardRes.data as any) || { monthlyRevenue: 0, recentTransactions: [] };

            // Mesma semântica do web (financial/page.tsx)
            const payingCount = students.filter(
                (s) => s.display_status === "active" || s.display_status === "awaiting_payment"
            ).length;
            const courtesyCount = students.filter((s) => s.display_status === "courtesy").length;
            const attention = students.filter(
                (s) =>
                    s.display_status === "overdue" ||
                    s.display_status === "grace_period" ||
                    s.display_status === "canceling" ||
                    s.display_status === "expired"
            );

            // Resolve nomes de alunos pras cobranças pendentes
            const nameById = new Map<string, string>();
            for (const s of students) nameById.set(s.student_id, s.student_name);

            const pending: PendingCharge[] = ((pendingRes?.data as any[]) || []).map((c) => ({
                contractId: c.id,
                studentName: c.student_id ? nameById.get(c.student_id) ?? null : null,
                amount: Number(c.amount ?? 0),
                billingType: c.billing_type ?? null,
                createdAt: c.created_at,
            }));

            const payouts: AwaitingPayout[] = ((payoutsRes?.data as any[]) || []).map((p) => ({
                id: p.id,
                amount: Number(p.amount_cents ?? 0) / 100,
                requestedAt: p.requested_at ?? null,
                pixKeyType: p.pix_key_type_snapshot ?? null,
            }));

            setData({
                monthlyRevenue: Number(dashboard.monthlyRevenue) || 0,
                recentTransactions: (dashboard.recentTransactions || []) as FinancialTransaction[],
                payingCount,
                courtesyCount,
                attentionCount: attention.length,
                totalStudents: students.length,
            });
            setAttentionStudents(attention);
            setPendingCharges(pending);
            setAwaitingPayouts(payouts);
            setError(null);
        } catch (err) {
            if (__DEV__) console.error("[useFinancialDashboard] error:", err);
            // P16: sem isto, falha de rede/RPC renderizava "R$ 0,00 / 0 alunos"
            // como se fosse dado real — na tela onde o treinador gere o negócio.
            setError("Não foi possível carregar os dados financeiros.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [trainerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = useCallback(() => fetchData(true), [fetchData]);

    return { data, attentionStudents, pendingCharges, awaitingPayouts, isLoading, isRefreshing, error, refresh };
}
