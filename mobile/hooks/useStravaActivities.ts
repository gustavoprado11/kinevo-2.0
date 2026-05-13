// Fase 16 · Hooks de leitura de atividades Strava (read-only views do banco).
// - useStravaDays(N): Set<YYYY-MM-DD> dos últimos N dias com atividade Strava
// - useStravaWeekSummary(): agregado semana (total km, count, breakdown por tipo)
// - useStravaActivities({ days, types? }): lista bruta pra Histórico

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import type { Database } from "@kinevo/shared";

type ExternalActivityRow =
    Database["public"]["Tables"]["external_activities"]["Row"];

function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function daysAgoISO(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

async function fetchStudentId(): Promise<string | null> {
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

async function fetchActivities(daysBack: number): Promise<ExternalActivityRow[]> {
    const studentId = await fetchStudentId();
    if (!studentId) return [];
    const { data, error } = await supabase
        .from("external_activities" as any)
        .select("*")
        .eq("student_id", studentId)
        .gte("started_at", daysAgoISO(daysBack))
        .order("started_at", { ascending: false });
    if (error) return [];
    return (data as unknown as ExternalActivityRow[] | null) ?? [];
}

export function useStravaDays(daysBack = 30) {
    const [days, setDays] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        setIsLoading(true);
        const rows = await fetchActivities(daysBack);
        const set = new Set<string>();
        for (const row of rows) {
            set.add(toDateKey(new Date(row.started_at)));
        }
        setDays(set);
        setIsLoading(false);
    }, [daysBack]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { days, isLoading, reload };
}

export interface StravaWeekSummary {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    count: number;
    byType: Record<string, number>;
}

export function useStravaWeekSummary() {
    const [activities, setActivities] = useState<ExternalActivityRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        setIsLoading(true);
        const rows = await fetchActivities(7);
        setActivities(rows);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const summary = useMemo<StravaWeekSummary>(() => {
        const byType: Record<string, number> = {};
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;
        for (const a of activities) {
            totalDistanceMeters += a.distance_meters ?? 0;
            totalDurationSeconds += a.duration_seconds ?? 0;
            byType[a.activity_type] = (byType[a.activity_type] ?? 0) + 1;
        }
        return {
            totalDistanceMeters,
            totalDurationSeconds,
            count: activities.length,
            byType,
        };
    }, [activities]);

    return { summary, activities, isLoading, reload };
}

export function useStravaActivities(daysBack = 90) {
    const [activities, setActivities] = useState<ExternalActivityRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        setIsLoading(true);
        const rows = await fetchActivities(daysBack);
        setActivities(rows);
        setIsLoading(false);
    }, [daysBack]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { activities, isLoading, reload };
}
