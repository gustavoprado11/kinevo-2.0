import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type {
    FinancialStudent,
    FinancialDashboardData,
    FinancialTransaction,
} from "../types/financial";

export function useFinancialDashboard() {
    const { trainerId } = useRoleMode();
    const [data, setData] = useState<FinancialDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async (refreshing = false) => {
        if (!trainerId) return;

        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            // Parallel: financial students + dashboard RPCs
            const [studentsRes, dashboardRes] = await Promise.all([
                (supabase as any).rpc("get_financial_students", { p_trainer_id: trainerId }),
                (supabase as any).rpc("get_financial_dashboard"),
            ]);

            const students: FinancialStudent[] = (studentsRes.data as any) || [];
            const dashboard = (dashboardRes.data as any) || { monthlyRevenue: 0, recentTransactions: [] };

            // Aggregate counts client-side
            const payingCount = students.filter(
                (s) => s.display_status === "active" || s.display_status === "grace_period"
            ).length;

            const courtesyCount = students.filter(
                (s) => s.display_status === "courtesy"
            ).length;

            const attentionCount = students.filter(
                (s) =>
                    s.display_status === "overdue" ||
                    s.display_status === "grace_period" ||
                    s.display_status === "canceling"
            ).length;

            setData({
                monthlyRevenue: Number(dashboard.monthlyRevenue) || 0,
                recentTransactions: (dashboard.recentTransactions || []) as FinancialTransaction[],
                payingCount,
                courtesyCount,
                attentionCount,
                totalStudents: students.length,
            });
        } catch (err) {
            if (__DEV__) console.error("[useFinancialDashboard] error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [trainerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = useCallback(() => fetchData(true), [fetchData]);

    return { data, isLoading, isRefreshing, refresh };
}
