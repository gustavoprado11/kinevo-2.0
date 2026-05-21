import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type { FinancialStudent, ContractEvent } from "../types/financial";

/** Campos reais do contrato (a RPC get_financial_students não expõe Asaas). */
export interface ContractRow {
    status: string | null;
    billing_type: string | null;
    provider: string | null;
    asaas_payment_link_id: string | null;
    asaas_payment_id: string | null;
}

export function useContractDetail(contractId: string | null) {
    const { trainerId } = useRoleMode();
    const [student, setStudent] = useState<FinancialStudent | null>(null);
    const [contract, setContract] = useState<ContractRow | null>(null);
    const [events, setEvents] = useState<ContractEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!trainerId || !contractId) return;

        setIsLoading(true);

        try {
            // V1: fetch all students and find the one with matching contract_id.
            // Em paralelo, busca os campos reais do contrato (status/provider/
            // billing_type/link Asaas) — a RPC não expõe esses dados Asaas.
            const [studentsRes, eventsRes, contractRes] = await Promise.all([
                (supabase as any).rpc("get_financial_students", { p_trainer_id: trainerId }),
                (supabase as any).rpc("get_contract_events", { p_contract_id: contractId }),
                supabase
                    .from("student_contracts")
                    .select("status, billing_type, provider, asaas_payment_link_id, asaas_payment_id")
                    .eq("id", contractId)
                    .maybeSingle(),
            ]);

            const students = (studentsRes.data as any as FinancialStudent[]) || [];
            const match = students.find((s) => s.contract_id === contractId) || null;
            setStudent(match);

            setContract((contractRes.data as any as ContractRow) ?? null);

            const eventsData = (eventsRes.data as any) || {};
            setEvents((eventsData.events || []) as ContractEvent[]);
        } catch (err) {
            if (__DEV__) console.error("[useContractDetail] error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [trainerId, contractId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { student, contract, events, isLoading, refresh: fetchData };
}
