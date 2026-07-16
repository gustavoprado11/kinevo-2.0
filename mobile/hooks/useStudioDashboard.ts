import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import { useCachedQuery } from "./useCachedQuery";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cache-keys";

// ── Types ──

export interface StudioMembership {
    orgId: string;
    orgName: string;
    /** owner/admin = gestor (vê o painel). Coach comum não. */
    isManager: boolean;
    /** Billing da org ativo (active/trialing, ou past_due dentro da graça). */
    billingActive: boolean;
}

export interface StudioCoachStats {
    coach_id: string;
    coach_name: string;
    active_students: number;
    completed_sessions: number;
    expected_sessions: number;
    adherence_pct: number | null;
}

export interface StudioStudentOverview {
    student_id: string;
    student_name: string;
    coach_id: string | null;
    coach_name: string | null;
    has_active_program: boolean;
    last_session: string | null;
    at_risk: boolean;
}

export interface StudioDashboardData {
    coaches: StudioCoachStats[];
    students: StudioStudentOverview[];
}

// ── Helpers ──

/** Mesma regra de isOrgBillingActive da web (org-access.ts). */
function isOrgBillingActive(status: string, graceUntil: string | null): boolean {
    if (status === "active" || status === "trialing") return true;
    return status === "past_due" && !!graceUntil && new Date(graceUntil).getTime() > Date.now();
}

/** Segunda-feira da semana corrente (convenção do produto), como YYYY-MM-DD local. */
function currentWeekStart(): string {
    const now = new Date();
    const day = now.getDay(); // 0=dom … 6=sáb
    const diff = day === 0 ? 6 : day - 1; // distância até segunda
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const mm = String(monday.getMonth() + 1).padStart(2, "0");
    const dd = String(monday.getDate()).padStart(2, "0");
    return `${monday.getFullYear()}-${mm}-${dd}`;
}

// ── Hooks ──

/**
 * Vínculo do treinador logado com um estúdio (ou null). Leve — usado na aba
 * "Mais" pra decidir se a entrada "Painel do estúdio" aparece. RLS: o membro
 * lê o próprio vínculo + a própria org (org_members_member_read).
 */
export function useStudioMembership() {
    const { trainerId } = useRoleMode();

    const fetcher = useCallback(async (): Promise<StudioMembership | null> => {
        const { data, error } = await supabase
            .from("organization_members" as any)
            .select("role, organization:organizations(id, name, subscription_status, grace_until)")
            .eq("trainer_id", trainerId)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return null;
        const rel = (data as any).organization;
        const org = Array.isArray(rel) ? rel[0] : rel;
        if (!org) return null;
        return {
            orgId: org.id as string,
            orgName: org.name as string,
            isManager: ["owner", "admin"].includes((data as any).role as string),
            billingActive: isOrgBillingActive(org.subscription_status, org.grace_until),
        };
    }, [trainerId]);

    const { data, isLoading, error, refresh } = useCachedQuery<StudioMembership | null>({
        cacheKey: CACHE_KEYS.STUDIO_MEMBERSHIP,
        fetcher,
        ttl: CACHE_TTL.STUDIO_MEMBERSHIP,
        enabled: !!trainerId,
    });

    return { membership: data ?? null, isLoading, error, refresh };
}

/**
 * Painel do gestor: KPIs por treinador + visão dos alunos do estúdio.
 * Reusa os RPCs do painel web (migr 256) — o gate is_org_manager roda no
 * servidor (não-gestor recebe zero linhas).
 */
export function useStudioDashboard() {
    const { membership, isLoading: loadingMembership } = useStudioMembership();
    const orgId = membership?.orgId ?? null;

    const fetcher = useCallback(async (): Promise<StudioDashboardData> => {
        const weekStart = currentWeekStart();
        const [coachesRes, studentsRes] = await Promise.all([
            (supabase as any).rpc("get_org_coach_week_stats", { p_org: orgId, p_week_start: weekStart }),
            (supabase as any).rpc("get_org_students_overview", { p_org: orgId }),
        ]);
        if (coachesRes.error) throw new Error(coachesRes.error.message);
        if (studentsRes.error) throw new Error(studentsRes.error.message);
        return {
            coaches: (coachesRes.data ?? []) as StudioCoachStats[],
            students: (studentsRes.data ?? []) as StudioStudentOverview[],
        };
    }, [orgId]);

    const { data, isLoading, isRefreshing, error, refresh } = useCachedQuery<StudioDashboardData>({
        cacheKey: CACHE_KEYS.STUDIO_DASHBOARD,
        fetcher,
        ttl: CACHE_TTL.STUDIO_DASHBOARD,
        enabled: !!orgId && !!membership?.isManager,
    });

    const coaches = data?.coaches ?? [];
    const students = data?.students ?? [];

    // KPIs agregados do estúdio a partir das linhas por coach.
    const totals = {
        activeStudents: coaches.reduce((acc, c) => acc + Number(c.active_students ?? 0), 0),
        completedSessions: coaches.reduce((acc, c) => acc + Number(c.completed_sessions ?? 0), 0),
        expectedSessions: coaches.reduce((acc, c) => acc + Number(c.expected_sessions ?? 0), 0),
        atRisk: students.filter((s) => s.at_risk).length,
    };
    const adherencePct = totals.expectedSessions > 0
        ? Math.round((totals.completedSessions * 100) / totals.expectedSessions)
        : null;

    return {
        membership,
        coaches,
        students,
        totals,
        adherencePct,
        isLoading: loadingMembership || isLoading,
        isRefreshing,
        error,
        refresh,
    };
}
