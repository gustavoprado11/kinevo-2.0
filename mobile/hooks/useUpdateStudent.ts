import { useCallback, useState } from "react";
import {
    FunctionsHttpError,
    FunctionsRelayError,
    FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getCached, setCache } from "../lib/cache";
import { CACHE_KEYS } from "../lib/cache-keys";
import type { Student, StudentModality } from "../types/student";
import type { TrainerStudent } from "./useTrainerStudentsList";

/**
 * Edge Function `update-student` mapeia `studentId` → `students.auth_user_id`
 * internamente ao sincronizar email via admin API. O consumidor do hook só
 * passa `studentId`; `auth_user_id` é responsabilidade da function.
 */
export interface UpdateStudentInput {
    studentId: string;
    name?: string;
    email?: string;
    phone?: string;
    modality?: StudentModality;
}

export type UpdateStudentResult =
    | { success: true; student: Student }
    | { success: false; error: string };

export function useUpdateStudent() {
    const [isUpdating, setIsUpdating] = useState(false);

    const updateStudent = useCallback(
        async (input: UpdateStudentInput): Promise<UpdateStudentResult> => {
            setIsUpdating(true);
            try {
                const { data: session } = await supabase.auth.getSession();
                if (!session?.session?.access_token) {
                    return {
                        success: false,
                        error: "Sessão expirada. Faça login novamente.",
                    };
                }

                const response = await supabase.functions.invoke(
                    "update-student",
                    { body: input }
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
                                    "Erro ao atualizar aluno.",
                            };
                        } catch {
                            return {
                                success: false,
                                error: "Erro ao atualizar aluno. Tente novamente.",
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
                    | { success: true; student: Student }
                    | { success: false; error: string }
                    | null;

                if (!data) {
                    return { success: false, error: "Resposta inválida do servidor." };
                }

                if (data.success === true && data.student) {
                    // Patch STUDENTS_LIST cache in-place to reflect edited fields
                    // without dropping aggregated columns (program_name, sessions_this_week, etc.).
                    const cached = getCached<TrainerStudent[]>(CACHE_KEYS.STUDENTS_LIST);
                    if (cached?.data) {
                        const next = cached.data.map((s) =>
                            s.id === data.student.id
                                ? {
                                      ...s,
                                      name: data.student.name,
                                      email: data.student.email,
                                      phone: data.student.phone,
                                      modality: data.student.modality,
                                  }
                                : s
                        );
                        setCache(CACHE_KEYS.STUDENTS_LIST, next);
                    }
                    return { success: true, student: data.student };
                }

                return {
                    success: false,
                    error:
                        ("error" in data && data.error) ||
                        "Erro ao atualizar aluno.",
                };
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Erro inesperado.";
                return { success: false, error: message };
            } finally {
                setIsUpdating(false);
            }
        },
        []
    );

    return { updateStudent, isUpdating };
}
