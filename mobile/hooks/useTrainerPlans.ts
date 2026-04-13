import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface TrainerPlan {
    id: string;
    title: string;
    description: string | null;
    price: number;
    interval: string;
    interval_count: number | null;
    is_active: boolean;
    visibility: string | null;
    stripe_product_id: string | null;
    stripe_price_id: string | null;
    created_at: string;
    student_count?: number;
}

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
}

export function useTrainerPlans() {
    const { trainerId } = useRoleMode();
    const [plans, setPlans] = useState<TrainerPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async (refreshing = false) => {
        if (!trainerId) return;

        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            // Fetch plans
            const { data: plansData } = await supabase
                .from("trainer_plans" as any)
                .select("*")
                .order("created_at", { ascending: false });

            // Fetch usage counts per plan
            const { data: contractsData } = await supabase
                .from("student_contracts" as any)
                .select("plan_id")
                .in("status", ["active", "past_due", "pending"]);

            const usageMap: Record<string, number> = {};
            if (contractsData) {
                for (const c of contractsData as any[]) {
                    if (c.plan_id) {
                        usageMap[c.plan_id] = (usageMap[c.plan_id] || 0) + 1;
                    }
                }
            }

            const enriched: TrainerPlan[] = ((plansData as any) || []).map((p: any) => ({
                ...p,
                student_count: usageMap[p.id] || 0,
            }));

            setPlans(enriched);
        } catch (err) {
            if (__DEV__) console.error("[useTrainerPlans] error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [trainerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = useCallback(() => fetchData(true), [fetchData]);

    const togglePlan = useCallback(async (planId: string): Promise<boolean> => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return false;

        const newActive = !plan.is_active;

        // Optimistic update
        setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, is_active: newActive } : p)));

        try {
            // If plan has Stripe product, call web API to sync
            if (plan.stripe_product_id) {
                const token = await getToken();
                if (token) {
                    await fetch(`${API_URL}/api/financial/plans/toggle`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ planId }),
                    });
                }
            }

            // Update in DB
            await supabase
                .from("trainer_plans" as any)
                .update({ is_active: newActive } as any)
                .eq("id", planId);

            return true;
        } catch (err) {
            // Revert optimistic update
            setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, is_active: !newActive } : p)));
            return false;
        }
    }, [plans]);

    const deletePlan = useCallback(async (planId: string): Promise<boolean> => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return false;

        // Optimistic remove
        setPlans((prev) => prev.filter((p) => p.id !== planId));

        try {
            // If plan has Stripe product, deactivate via web API
            if (plan.stripe_product_id) {
                const token = await getToken();
                if (token) {
                    await fetch(`${API_URL}/api/financial/plans/delete`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ planId }),
                    });
                }
            }

            await supabase
                .from("trainer_plans" as any)
                .delete()
                .eq("id", planId);

            return true;
        } catch (err) {
            // Revert
            setPlans((prev) => [...prev, plan].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ));
            return false;
        }
    }, [plans]);

    const createPlan = useCallback(async (input: {
        title: string;
        price: number;
        interval: string;
        description: string;
    }): Promise<{ success: boolean; error?: string }> => {
        try {
            const token = await getToken();
            if (!token) return { success: false, error: "Não autorizado" };

            // Call web API which handles both Stripe + DB creation
            const res = await fetch(`${API_URL}/api/financial/plans/create`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });

            const data = await res.json();
            if (data.success) {
                await fetchData(true);
                return { success: true };
            }
            return { success: false, error: data.error || "Erro ao criar plano" };
        } catch (err) {
            return { success: false, error: "Falha na conexão" };
        }
    }, [fetchData]);

    const updatePlan = useCallback(async (planId: string, input: {
        title: string;
        description: string;
    }): Promise<{ success: boolean; error?: string }> => {
        try {
            await supabase
                .from("trainer_plans" as any)
                .update({ title: input.title, description: input.description || null } as any)
                .eq("id", planId);

            setPlans((prev) => prev.map((p) =>
                p.id === planId ? { ...p, title: input.title, description: input.description || null } : p
            ));

            return { success: true };
        } catch (err) {
            return { success: false, error: "Erro ao atualizar plano" };
        }
    }, []);

    const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);

    return {
        plans,
        activePlans,
        isLoading,
        isRefreshing,
        refresh,
        togglePlan,
        deletePlan,
        createPlan,
        updatePlan,
    };
}
