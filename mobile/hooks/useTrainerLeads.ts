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
    converted_to_student_id: string | null;
}

export interface ConvertLeadResult {
    success: boolean;
    error?: string;
    studentId?: string;
    alreadyExisted?: boolean;
    credentials?: {
        name: string;
        email: string;
        password: string;
        whatsapp: string | null;
    };
}

interface UseTrainerLeadsResult {
    leads: TrainerLead[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updateStatus: (id: string, status: LeadStatus) => Promise<void>;
    convertLead: (lead: TrainerLead, modality: "online" | "presential") => Promise<ConvertLeadResult>;
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
            .select("id, name, email, whatsapp, goal, level, message, status, source, source_slug, created_at, converted_to_student_id")
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

    /**
     * Converte um lead em aluno (M5).
     *
     *   Espelha a lógica da action web convertLeadToStudent, mas client-side:
     *   - idempotente: lead já convertido devolve o vínculo existente
     *   - dedup por e-mail: se já existe aluno sob o trainer, vincula
     *   - senão invoca a edge function create-student (service role) e vincula
     *
     *   O update do lead passa pela RLS (trainer é dono); a criação de conta
     *   exige service role, por isso vai pela edge function (anon key não cria
     *   auth user).
     */
    const convertLead = useCallback(
        async (lead: TrainerLead, modality: "online" | "presential"): Promise<ConvertLeadResult> => {
            if (!trainerId) return { success: false, error: "Sessão expirada." };

            // Idempotência: já convertido.
            if (lead.converted_to_student_id) {
                return { success: true, studentId: lead.converted_to_student_id, alreadyExisted: true };
            }

            const email = lead.email.trim().toLowerCase();

            const markConverted = async (studentId: string) => {
                const client = supabase as unknown as {
                    from: (table: string) => {
                        update: (patch: Record<string, unknown>) => {
                            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
                        };
                    };
                };
                await client
                    .from("trainer_leads")
                    .update({ status: "converted", converted_to_student_id: studentId })
                    .eq("id", lead.id);
                setLeads((prev) =>
                    prev.map((l) =>
                        l.id === lead.id
                            ? { ...l, status: "converted" as LeadStatus, converted_to_student_id: studentId }
                            : l,
                    ),
                );
            };

            // Dedup: aluno existente com esse e-mail sob o trainer.
            const dedupClient = supabase as unknown as {
                from: (table: string) => {
                    select: (cols: string) => {
                        eq: (col: string, val: string) => {
                            eq: (col: string, val: string) => {
                                maybeSingle: () => Promise<{ data: { id: string } | null }>;
                            };
                        };
                    };
                };
            };
            const { data: existing } = await dedupClient
                .from("students")
                .select("id")
                .eq("coach_id", trainerId)
                .eq("email", email)
                .maybeSingle();

            if (existing?.id) {
                await markConverted(existing.id);
                return { success: true, studentId: existing.id, alreadyExisted: true };
            }

            // Cria a conta (cortesia) via edge function.
            const response = await supabase.functions.invoke("create-student", {
                body: { name: lead.name, email, phone: lead.whatsapp, modality },
            });
            if (response.error) {
                console.error("[useTrainerLeads] convert create-student error:", response.error);
                return { success: false, error: "Não foi possível criar o aluno." };
            }
            const result = response.data as {
                success?: boolean;
                studentId?: string;
                email?: string;
                password?: string;
                name?: string;
                whatsapp?: string | null;
                error?: string;
            };
            if (!result?.success || !result.studentId) {
                return { success: false, error: result?.error ?? "Não foi possível criar o aluno." };
            }

            await markConverted(result.studentId);
            return {
                success: true,
                studentId: result.studentId,
                alreadyExisted: false,
                credentials: {
                    name: result.name ?? lead.name,
                    email: result.email ?? email,
                    password: result.password ?? "",
                    whatsapp: result.whatsapp ?? lead.whatsapp,
                },
            };
        },
        [trainerId],
    );

    const unreadCount = leads.filter((l) => l.status === "new").length;

    return { leads, loading, error, refetch: fetchLeads, updateStatus, convertLead, unreadCount };
}
