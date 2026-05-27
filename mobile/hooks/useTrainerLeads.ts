import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export type LeadStatus = "new" | "read" | "contacted" | "converted" | "archived";

export interface TrainerLead {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    goal: string | null;
    level: string | null;
    message: string | null;
    status: LeadStatus;
    source: string | null;
    source_slug: string | null;
    created_at: string;
}

interface UseTrainerLeadsResult {
    leads: TrainerLead[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updateStatus: (id: string, status: LeadStatus) => Promise<void>;
    unreadCount: number;
}

/**
 * Hook que lista os leads do trainer logado (vindos da landing pública).
 *
 *  Realtime: subscreve INSERT/UPDATE em trainer_leads filtrado pelo trainer_id —
 *  o trainer vê novos leads chegar sem precisar refazer pull.
 *  RLS já garante isolamento (no banco), mas filtramos no cliente também
 *  pra reduzir tráfego.
 */
export function useTrainerLeads(): UseTrainerLeadsResult {
    const { trainerId } = useRoleMode();
    const [leads, setLeads] = useState<TrainerLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeads = useCallback(async () => {
        if (!trainerId) {
            setLeads([]);
            setLoading(false);
            return;
        }
        setError(null);
        // `trainer_leads` ainda não está nos tipos gerados (migration 166 nova) —
        // usamos `from(...)` cru com cast pra TrainerLead.
        const client = supabase as unknown as {
            from: (table: string) => {
                select: (cols: string) => {
                    eq: (col: string, val: string) => {
                        order: (col: string, opts: { ascending: boolean }) => {
                            limit: (n: number) => Promise<{ data: TrainerLead[] | null; error: { message: string } | null }>;
                        };
                    };
                };
            };
        };
        const { data, error: queryError } = await client
            .from("trainer_leads")
            .select("id, name, email, whatsapp, goal, level, message, status, source, source_slug, created_at")
            .eq("trainer_id", trainerId)
            .order("created_at", { ascending: false })
            .limit(500);

        if (queryError) {
            console.error("[useTrainerLeads] fetch error:", queryError);
            setError(queryError.message);
            setLeads([]);
        } else {
            setLeads((data ?? []) as TrainerLead[]);
        }
        setLoading(false);
    }, [trainerId]);

    useEffect(() => {
        setLoading(true);
        void fetchLeads();
    }, [fetchLeads]);

    /* Realtime: novos leads + updates de status */
    useEffect(() => {
        if (!trainerId) return;
        const channel = supabase
            .channel(`trainer_leads:${trainerId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "trainer_leads",
                    filter: `trainer_id=eq.${trainerId}`,
                },
                () => {
                    // Refetch full list ao invés de patch local — número de leads é pequeno.
                    void fetchLeads();
                },
            )
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    }, [trainerId, fetchLeads]);

    const updateStatus = useCallback(
        async (id: string, status: LeadStatus) => {
            // Optimistic update
            setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
            const client = supabase as unknown as {
                from: (table: string) => {
                    update: (patch: Record<string, unknown>) => {
                        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
                    };
                };
            };
            const { error: updateError } = await client
                .from("trainer_leads")
                .update({ status, updated_at: new Date().toISOString() })
                .eq("id", id);
            if (updateError) {
                console.error("[useTrainerLeads] update error:", updateError);
                // Rollback se falhou
                void fetchLeads();
            }
        },
        [fetchLeads],
    );

    const unreadCount = leads.filter((l) => l.status === "new").length;

    return { leads, loading, error, refetch: fetchLeads, updateStatus, unreadCount };
}
