import { useCallback, useState } from "react";
import {
    FunctionsHttpError,
    FunctionsRelayError,
    FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getCached, setCache, invalidateCache } from "../lib/cache";
import { CACHE_KEYS } from "../lib/cache-keys";
import type { TrainerStudent } from "./useTrainerStudentsList";

export type ArchiveStudentResult =
    | { success: true; studentId: string }
    | { success: false; error: string };

export function useArchiveStudent() {
    const [isArchiving, setIsArchiving] = useState(false);

    const archiveStudent = useCallback(
        async (studentId: string): Promise<ArchiveStudentResult> => {
            setIsArchiving(true);
            try {
                const { data: session } = await supabase.auth.getSession();
                if (!session?.session?.access_token) {
                    return {
                        success: false,
                        error: "Sessão expirada. Faça login novamente.",
                    };
                }

                const response = await supabase.functions.invoke(
                    "archive-student",
                    { body: { studentId } }
                );

                if (response.error) {
                    if (response.error instanceof FunctionsHttpError) {
                        try {
                            const errorBody = await response.error.context.json();
                            return {
                                success: false,
                                error:
                                    errorBody?.error ??
                                    errorBody?.message ??
                                    "Erro ao arquivar aluno.",
                            };
                        } catch {
                            return {
                                success: false,
                                error: "Erro ao arquivar aluno. Tente novamente.",
                            };
                        }
                    }
                    if (
                        response.error instanceof FunctionsRelayError ||
                        response.error instanceof FunctionsFetchError
                    ) {
                        return {
                            success: false,
                            error: "Erro de rede. Verifique sua conexão.",
                        };
                    }
                    return {
                        success: false,
                        error: response.error.message ?? "Erro desconhecido.",
                    };
                }

                const data = response.data as
                    | { success: true; studentId: string }
                    | { success: false; error: string }
                    | null;

                if (!data) {
                    return { success: false, error: "Resposta inválida do servidor." };
                }

                if (data.success === true) {
                    // Local mutation — remove o aluno da lista em cache sem forçar refetch imediato.
                    const cached = getCached<TrainerStudent[]>(CACHE_KEYS.STUDENTS_LIST);
                    if (cached?.data) {
                        const next = cached.data.filter((s) => s.id !== studentId);
                        setCache(CACHE_KEYS.STUDENTS_LIST, next);
                    }
                    // Cache do detalhe deixa de valer.
                    invalidateCache(CACHE_KEYS.STUDENT_DETAIL(studentId));
                    return { success: true, studentId };
                }

                return {
                    success: false,
                    error:
                        ("error" in data && data.error) ||
                        "Erro ao arquivar aluno.",
                };
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Erro inesperado.";
                return { success: false, error: message };
            } finally {
                setIsArchiving(false);
            }
        },
        []
    );

    return { archiveStudent, isArchiving };
}
