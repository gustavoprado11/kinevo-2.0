import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type { FinancialStudent, ContractEvent } from "../types/financial";

export function useContractDetail(contractId: string | null) {
    const { trainerId } = useRoleMode();
    const [student, setStudent] = useState<FinancialStudent | null>(null);
    const [events, setEvents] = useState<ContractEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!trainerId || !contractId) return;

        setIsLoading(true);

        try {
            // V1: fetch all students and find the one with matching contract_id
            const [studentsRes, eventsRes] = await Promise.all([
                (supabase as any).rpc("get_financial_students", { p_trainer_id: trainerId }),
                (supabase as any).rpc("get_contract_events", { p_contract_id: contractId }),
            ]);

            const students = (studentsRes.data as any as FinancialStudent[]) || [];
            const match = students.find((s) => s.contract_id === contractId) || null;
            setStudent(match);

            const eventsData = (eventsRes.data as any) || {};
            setEvents((eventsData.events || []) as ContractEvent[]);
        } catch (err) {
            console.error("[useContractDetail] error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [trainerId, contractId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { student, events, isLoading, refresh: fetchData };
}
