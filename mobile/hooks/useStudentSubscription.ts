import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useStudentProfile } from "./useStudentProfile";

export interface ContractWithPlan {
    id: string;
    amount: number;
    status: string;
    billing_type: string;
    block_on_fail: boolean;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    start_date: string | null;
    plan: {
        title: string;
        price: number;
        interval: string | null;
    } | null;
}

interface StudentSubscriptionResult {
    contract: ContractWithPlan | null;
    isLoading: boolean;
    refresh: () => void;
}

export function useStudentSubscription(): StudentSubscriptionResult {
    const { profile } = useStudentProfile();
    const [contract, setContract] = useState<ContractWithPlan | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSubscription = useCallback(async () => {
        if (!profile?.id) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error }: { data: any; error: any } = await supabase
                .from("student_contracts" as any)
                .select("*, plan:trainer_plans!plan_id(title, price, interval)")
                .eq("student_id", profile.id)
                .in("status", ["active", "past_due"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("[useStudentSubscription] Error:", error);
                setContract(null);
                return;
            }

            if (data) {
                setContract({
                    id: data.id,
                    amount: data.amount ?? 0,
                    status: data.status,
                    billing_type: data.billing_type ?? "manual_recurring",
                    block_on_fail: data.block_on_fail ?? true,
                    current_period_end: data.current_period_end ?? null,
                    cancel_at_period_end: data.cancel_at_period_end ?? false,
                    start_date: data.start_date ?? null,
                    plan: data.plan
                        ? {
                              title: data.plan.title,
                              price: data.plan.price ?? 0,
                              interval: data.plan.interval ?? null,
                          }
                        : null,
                });
            } else {
                setContract(null);
            }
        } catch (err) {
            console.error("[useStudentSubscription] Error:", err);
            setContract(null);
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    return { contract, isLoading, refresh: fetchSubscription };
}
