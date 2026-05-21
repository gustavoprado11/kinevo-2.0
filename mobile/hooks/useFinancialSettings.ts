// ============================================================================
// useFinancialSettings — lê/grava trainer_financial_settings via API Bearer
// ============================================================================
// GET   /api/financial/settings → FinancialSettings (camelCase)
// PATCH /api/financial/settings  { key: value } → FinancialSettings atualizado
// Espelha web/src/lib/financial/settings.ts.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { walletFetch } from "../lib/wallet-api";

export interface FinancialSettings {
    defaultAllowPix: boolean;
    defaultAllowCreditCard: boolean;
    defaultAllowBoleto: boolean;
    blockOnOverdue: boolean;
    overdueGraceDays: number;
    notifyOnPaymentReceived: boolean;
    notifyOnSubscriptionCanceled: boolean;
    notifyOnPayoutCompleted: boolean;
    notifyOnKycAlert: boolean;
    showStripeLegacy: boolean;
}

export function useFinancialSettings() {
    const [settings, setSettings] = useState<FinancialSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<keyof FinancialSettings | null>(null);
    const [savedKey, setSavedKey] = useState<keyof FinancialSettings | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await walletFetch<FinancialSettings>("/api/financial/settings");
                if (!cancelled) setSettings(data);
            } catch (err) {
                if (__DEV__) console.error("[useFinancialSettings] load:", err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const save = useCallback(async <K extends keyof FinancialSettings>(key: K, value: FinancialSettings[K]) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
        setSavingKey(key);
        setSavedKey(null);
        try {
            const updated = await walletFetch<FinancialSettings>("/api/financial/settings", {
                method: "PATCH",
                body: { [key]: value },
            });
            setSettings(updated);
            setSavedKey(key);
            setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
        } catch (err) {
            // Recarrega o estado real do servidor pra reverter o otimista
            try {
                const fresh = await walletFetch<FinancialSettings>("/api/financial/settings");
                setSettings(fresh);
            } catch { /* ignore */ }
            Alert.alert("Não foi possível salvar", err instanceof Error ? err.message : "Tente novamente.");
        } finally {
            setSavingKey(null);
        }
    }, []);

    return { settings, isLoading, savingKey, savedKey, save };
}
