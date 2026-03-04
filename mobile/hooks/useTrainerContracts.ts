import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type { FinancialStudent } from "../types/financial";

export type ContractFilter = "all" | "paying" | "courtesy" | "attention" | "canceled";

export function useTrainerContracts() {
    const { trainerId } = useRoleMode();
    const [allContracts, setAllContracts] = useState<FinancialStudent[]>([]);
    const [filter, setFilter] = useState<ContractFilter>("all");
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async (refreshing = false) => {
        if (!trainerId) return;

        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const { data } = await (supabase as any).rpc("get_financial_students", {
                p_trainer_id: trainerId,
            });

            setAllContracts((data as any as FinancialStudent[]) || []);
        } catch (err) {
            console.error("[useTrainerContracts] error:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [trainerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = useCallback(() => fetchData(true), [fetchData]);

    const contracts = useMemo(() => {
        let filtered = allContracts;

        // Filter by status
        switch (filter) {
            case "paying":
                filtered = filtered.filter(
                    (s) => s.display_status === "active" || s.display_status === "grace_period"
                );
                break;
            case "courtesy":
                filtered = filtered.filter((s) => s.display_status === "courtesy");
                break;
            case "attention":
                filtered = filtered.filter(
                    (s) =>
                        s.display_status === "overdue" ||
                        s.display_status === "grace_period" ||
                        s.display_status === "canceling"
                );
                break;
            case "canceled":
                filtered = filtered.filter((s) => s.display_status === "canceled");
                break;
        }

        // Search by name
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter((s) =>
                s.student_name.toLowerCase().includes(q)
            );
        }

        return filtered;
    }, [allContracts, filter, search]);

    const counts = useMemo(() => ({
        all: allContracts.length,
        paying: allContracts.filter(
            (s) => s.display_status === "active" || s.display_status === "grace_period"
        ).length,
        courtesy: allContracts.filter((s) => s.display_status === "courtesy").length,
        attention: allContracts.filter(
            (s) =>
                s.display_status === "overdue" ||
                s.display_status === "grace_period" ||
                s.display_status === "canceling"
        ).length,
        canceled: allContracts.filter((s) => s.display_status === "canceled").length,
    }), [allContracts]);

    return { contracts, counts, filter, setFilter, search, setSearch, isLoading, isRefreshing, refresh };
}
