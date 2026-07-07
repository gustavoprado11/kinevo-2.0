// ============================================================================
// useStudentPendingCharge — checagem LEVE de cobrança pendente (banner da home)
// ============================================================================
// Diferente do useStudentPayment (que chama GET /api/student/payment e busca a
// URL viva do link na ASAAS — pesado demais pra rodar em todo mount da home),
// este hook faz uma query direta no Supabase sob RLS: o aluno lê o próprio
// contrato. Só responde "existe cobrança pendente/atrasada?" — o detalhe e o
// link vivo ficam pra tela /payment.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface PendingChargeInfo {
    hasPending: boolean;
    status: "pending_payment" | "past_due" | null;
    amount: number | null;
}

export function useStudentPendingCharge() {
    const { user } = useAuth();
    const [info, setInfo] = useState<PendingChargeInfo>({ hasPending: false, status: null, amount: null });

    const refresh = useCallback(async () => {
        if (!user) return;
        try {
            const { data: student }: { data: any } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .maybeSingle();
            if (!student?.id) return;

            const { data: contract }: { data: any } = await supabase
                .from("student_contracts" as any)
                .select("status, amount")
                .eq("student_id", student.id)
                .in("status", ["pending_payment", "past_due"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            setInfo({
                hasPending: !!contract,
                status: contract?.status ?? null,
                amount: contract?.amount != null ? Number(contract.amount) : null,
            });
        } catch {
            // silencioso: banner é informativo — erro não pode quebrar a home
        }
    }, [user]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { ...info, refresh };
}
