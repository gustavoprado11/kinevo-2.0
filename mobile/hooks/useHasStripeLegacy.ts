// ============================================================================
// useHasStripeLegacy — trainer ainda tem contratos Stripe legados ativos?
// ============================================================================
// Espelha a regra do web (financial/page.tsx): a UI de Stripe só aparece se o
// trainer tem contrato active/past_due com billing_type='stripe_auto' ou
// stripe_subscription_id preenchido. Asaas é o padrão; Stripe fica escondido.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export function useHasStripeLegacy() {
    const { trainerId } = useRoleMode();
    const [hasLegacy, setHasLegacy] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        if (!trainerId) {
            setIsLoading(false);
            return;
        }
        (async () => {
            const { data } = await supabase
                .from("student_contracts")
                .select("id")
                .eq("trainer_id", trainerId)
                .in("status", ["active", "past_due"])
                .or("billing_type.eq.stripe_auto,stripe_subscription_id.not.is.null")
                .limit(1);
            if (!cancelled) {
                setHasLegacy((data?.length ?? 0) > 0);
                setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [trainerId]);

    return { hasLegacy, isLoading };
}
