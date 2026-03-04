import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { StripeConnectStatus } from "../types/financial";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

export function useStripeStatus() {
    const [status, setStatus] = useState<StripeConnectStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;

            const res = await fetch(`${API_URL}/api/financial/stripe-status`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const contentType = res.headers.get("content-type") || "";
            if (res.ok && contentType.includes("application/json")) {
                const data = await res.json();
                setStatus(data as StripeConnectStatus);
            }
        } catch (err) {
            console.error("[useStripeStatus] error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return { status, isLoading, refresh: fetchStatus };
}
