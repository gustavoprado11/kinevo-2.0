// Hook Oura — orquestra OAuth + sync via edge functions (Modelo B server-side).
// O status vem de wearable_connections (não há token no device).
import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import {
  disconnectOura,
  exchangeCodeForToken,
  openAuthorizationFlow,
  syncOura,
} from "../lib/oura/oauth";
import type { OuraSyncResponse } from "../lib/oura/types";

export interface UseOuraSyncResult {
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  requestAuthorization: () => Promise<boolean>;
  syncNow: (days?: number) => Promise<OuraSyncResponse>;
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

export function useOuraSync(): UseOuraSyncResult {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const studentId = await getStudentIdFromAuth();
    if (!studentId) {
      setIsAuthorized(false);
      return;
    }
    const { data } = await supabase
      .from("wearable_connections" as any)
      .select("status")
      .eq("student_id", studentId)
      .eq("source", "oura")
      .maybeSingle();
    setIsAuthorized((data as { status?: string } | null)?.status === "active");
  }, []);

  useEffect(() => {
    refreshStatus().catch(() => {
      // refreshStatus já trata internamente.
    });
  }, [refreshStatus]);

  const requestAuthorization = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await openAuthorizationFlow();
      if (result.cancelled) return false;
      if (!result.code) {
        setError(result.error ?? "Autorização falhou");
        return false;
      }
      // Edge function troca o code, guarda tokens server-side e faz backfill.
      await exchangeCodeForToken(result.code);
      await refreshStatus();
      setIsAuthorized(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const syncNow = useCallback(async (days = 7): Promise<OuraSyncResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await syncOura(days);
      if (!res.ok && res.error) setError(res.error);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await disconnectOura();
      setIsAuthorized(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
      // Mesmo em falha, reflete desconectado localmente (best-effort).
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
    syncNow,
    disconnect,
    refreshStatus,
  };
}
