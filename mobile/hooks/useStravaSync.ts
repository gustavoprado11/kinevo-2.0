// Fase 16 · Hook Strava sync — orquestra OAuth + chamadas ao syncStrava pure fn.
// Signature paralela ao useHealthKitSync.

import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import {
    clearStoredTokens,
    deauthorizeStrava,
    exchangeCodeForToken,
    getStoredTokens,
    openAuthorizationFlow,
} from "../lib/strava/oauth";
import {
    ALL_STRAVA_CATEGORIES,
    isStravaConnected,
    syncStravaHistorical,
    syncStravaIncremental,
    type StravaSyncResult,
} from "../lib/healthSync/stravaSync";

export interface UseStravaSyncResult {
    isAuthorized: boolean;
    isLoading: boolean;
    error: string | null;
    requestAuthorization: () => Promise<boolean>;
    syncHistorical: (perPage?: number) => Promise<StravaSyncResult>;
    syncIncremental: (daysBack?: number) => Promise<StravaSyncResult>;
    disconnect: () => Promise<void>;
    refreshStatus: () => Promise<void>;
}

async function getStudentIdFromAuth(): Promise<string | null> {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return null;
    const { data: student } = await supabase
        .from("students" as any)
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
    return (student as { id?: string } | null)?.id ?? null;
}

export function useStravaSync(): UseStravaSyncResult {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        const stored = await getStoredTokens();
        if (!stored) {
            setIsAuthorized(false);
            return;
        }
        const connected = await isStravaConnected(supabase);
        setIsAuthorized(connected);
    }, []);

    useEffect(() => {
        refreshStatus().catch(() => {
            // refreshStatus já trata internamente — silencioso aqui.
        });
    }, [refreshStatus]);

    const requestAuthorization = useCallback(async (): Promise<boolean> => {
        setError(null);
        setIsLoading(true);
        try {
            const result = await openAuthorizationFlow();
            if (result.cancelled) {
                setIsLoading(false);
                return false;
            }
            if (!result.code) {
                setError(result.error ?? "Autorização falhou");
                setIsLoading(false);
                return false;
            }

            const tokens = await exchangeCodeForToken(result.code);

            const studentId = await getStudentIdFromAuth();
            if (!studentId) {
                setError("Aluno não encontrado");
                setIsLoading(false);
                return false;
            }

            const { error: upsertError } = await supabase
                .from("wearable_connections" as any)
                .upsert(
                    {
                        student_id: studentId,
                        source: "strava",
                        status: "active",
                        granted_categories: ALL_STRAVA_CATEGORIES,
                        external_user_id: tokens.athleteId,
                        connected_at: new Date().toISOString(),
                        last_error: null,
                    },
                    { onConflict: "student_id,source" },
                );

            if (upsertError) {
                setError(upsertError.message);
                setIsLoading(false);
                return false;
            }

            setIsAuthorized(true);
            setIsLoading(false);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : "unknown";
            setError(message);
            setIsLoading(false);
            return false;
        }
    }, []);

    const syncHistorical = useCallback(
        async (perPage = 30): Promise<StravaSyncResult> => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await syncStravaHistorical(supabase, perPage);
                if (!res.ok && res.error) setError(res.error);
                return res;
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    const syncIncremental = useCallback(
        async (daysBack = 7): Promise<StravaSyncResult> => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await syncStravaIncremental(supabase, daysBack);
                if (!res.ok && res.error) setError(res.error);
                return res;
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    const disconnect = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await deauthorizeStrava();
            const studentId = await getStudentIdFromAuth();
            if (studentId) {
                await supabase
                    .from("wearable_connections" as any)
                    .update({
                        status: "revoked",
                        revoked_at: new Date().toISOString(),
                    })
                    .eq("student_id", studentId)
                    .eq("source", "strava");
            }
            setIsAuthorized(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "unknown";
            setError(message);
            // Cleanup garantido mesmo em falha de update remoto.
            await clearStoredTokens().catch(() => undefined);
            setIsAuthorized(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        isAuthorized,
        isLoading,
        error,
        requestAuthorization,
        syncHistorical,
        syncIncremental,
        disconnect,
        refreshStatus,
    };
}
