import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { decrementUnreadNotifications } from "./useUnreadCount";

// ============================================================================
// useLatestUnreadReport
// ============================================================================
// Retorna o inbox item mais recente do tipo `program_report_published` ainda
// não lido pelo aluno. Usado pra renderizar o card "Parabéns, seu relatório
// chegou!" no topo do home.
//
// Design:
// - Só pega o mais recente (Fase 3 escolheu "um card por vez" pra evitar
//   ruído visual; múltiplos relatórios novos é caso raro).
// - Realtime via Supabase channel, igual `useInbox`.
// - `markOpened` atualiza read_at + status='completed' otimisticamente.
// ============================================================================

export interface LatestUnreadReport {
    id: string;               // student_inbox_item.id
    reportId: string;         // payload.report_id (program_reports.id)
    programName: string;
    createdAt: string;
}

export function useLatestUnreadReport() {
    const { user } = useAuth();
    const [studentId, setStudentId] = useState<string | null>(null);
    const studentIdRef = useRef<string | null>(null);
    const [item, setItem] = useState<LatestUnreadReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Resolve student table ID from auth UID (one-time lookup).
    useEffect(() => {
        if (!user) {
            setStudentId(null);
            studentIdRef.current = null;
            return;
        }
        (async () => {
            const { data }: { data: any; error: any } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .single();
            if (data?.id) {
                setStudentId(data.id);
                studentIdRef.current = data.id;
            }
        })();
    }, [user]);

    const fetch = useCallback(async () => {
        if (!studentIdRef.current) return;

        const { data, error }: { data: any; error: any } = await supabase
            .from("student_inbox_items" as any)
            .select("id, payload, created_at")
            .eq("student_id", studentIdRef.current)
            .eq("type", "program_report_published")
            .eq("status", "unread")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            if (__DEV__) console.error("[useLatestUnreadReport] fetch error:", error);
            setItem(null);
            return;
        }

        if (!data) {
            setItem(null);
            return;
        }

        const reportId: string | undefined = data.payload?.report_id;
        if (!reportId) {
            // Sem report_id no payload a notificação é malformada —
            // ignorar em vez de mostrar um card quebrado.
            setItem(null);
            return;
        }

        setItem({
            id: data.id,
            reportId,
            programName: data.payload?.program_name ?? "seu programa",
            createdAt: data.created_at,
        });
    }, []);

    useEffect(() => {
        let mounted = true;
        if (!user || !studentId) {
            if (!user) {
                setItem(null);
                setIsLoading(false);
            }
            return;
        }

        (async () => {
            setIsLoading(true);
            await fetch();
            if (mounted) setIsLoading(false);
        })();

        const channel = supabase
            .channel(`student_inbox_report_${studentId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "student_inbox_items",
                    filter: `student_id=eq.${studentId}`,
                },
                () => {
                    fetch();
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [user, studentId, fetch]);

    /**
     * Marca como lido (read_at + status='completed') e dispensa o card
     * localmente. Otimista — o servidor reconfirma via realtime mas a UI
     * não espera round-trip.
     */
    const markOpened = useCallback(async () => {
        if (!item || !studentIdRef.current) return;

        // Optimistic UI: o card some imediatamente.
        const previous = item;
        setItem(null);
        decrementUnreadNotifications(1);

        const now = new Date().toISOString();
        const { error } = await supabase
            .from("student_inbox_items" as any)
            .update({
                read_at: now,
                status: "completed",
                completed_at: now,
            })
            .eq("id", previous.id)
            .eq("student_id", studentIdRef.current);

        if (error) {
            if (__DEV__) console.error("[useLatestUnreadReport] markOpened error:", error);
            // Rollback se falhou. Realtime vai reconciliar na próxima vinda
            // de dados, mas deixar o card voltar mantém o estado honesto.
            setItem(previous);
        }
    }, [item]);

    return { item, isLoading, markOpened };
}
